import { Hono, type Context } from 'hono';
import { config } from '#/config.js';
import { DDay } from '#/models/DDay.js';
import { Reminder } from '#/models/Reminder.js';
import { getBotUptime } from '#/services/uptime.js';
import { getTranslationCounts } from '#/services/translation.js';
import { escapeRegex } from '#/utils/regex.js';
import { requireAuth, type AuthEnv } from '../middleware/auth.js';
import type { Session } from '../middleware/session.js';
import { getModelDef, modelRegistry, type ModelDef } from '../utils/models.js';

const api = new Hono<AuthEnv>();

api.use('*', requireAuth);

// --- Helpers ---

function sanitize(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.every((item) => sanitize(item));
  }
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      if (key.startsWith('$') || key.startsWith('__')) return false;
      if (!sanitize(obj[key])) return false;
    }
  }
  return true;
}

/** The JSON object in the request body, or null if it isn't one. */
async function readBody(c: Context): Promise<Record<string, unknown> | null> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return null;
  }
  return typeof body === 'object' && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : null;
}

function filterFields(
  modelName: string,
  body: Record<string, unknown>,
): Record<string, unknown> {
  const def = getModelDef(modelName);
  if (!def) return {};
  const allowed = new Set(
    def.fields.filter((f) => !f.readOnly).map((f) => f.name),
  );
  const filtered: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (allowed.has(k)) filtered[k] = v;
  }
  return filtered;
}

// Discord IDs are 64-bit snowflakes, written in decimal
const SNOWFLAKE = /^\d{17,20}$/;

/** The first field in `data` that should hold a Discord ID but doesn't. */
function invalidIdField(
  modelName: string,
  data: Record<string, unknown>,
): string | undefined {
  const def = getModelDef(modelName);
  return def?.fields.find((f) => {
    if (!f.snowflake || !(f.name in data)) return false;
    const value = data[f.name];
    return typeof value !== 'string' || !SNOWFLAKE.test(value);
  })?.name;
}

function canWrite(session: Session, modelName: string): boolean {
  const def = getModelDef(modelName);
  if (!def) return false;
  if (def.readOnly) return false;
  if (def.ownerOnly) return session.role === 'owner';
  return session.role === 'admin' || session.role === 'owner';
}

/**
 * Whether `session` sees every user's records in a private model. Only the
 * owner does: reminders and D-Days can hold text their user asked to get by
 * DM, so admins see only their own, like members.
 */
function seesAllPrivate(session: Session): boolean {
  return session.role === 'owner';
}

/** The query filter limiting `def` to the records `session` may see. */
function privacyFilter(
  def: ModelDef,
  session: Session,
): Record<string, unknown> {
  return def.hasPrivacy && def.ownerField && !seesAllPrivate(session)
    ? { [def.ownerField]: session.userId }
    : {};
}

/** Fields of `def` that `session` sees only on their own records. */
function hiddenFields(def: ModelDef, session: Session): string[] {
  if (session.role !== 'member') return [];
  return def.fields.filter((f) => f.memberHidden).map((f) => f.name);
}

/** `doc` without the fields `session` may not see on it. */
function withoutHidden<T>(def: ModelDef, session: Session, doc: T): T {
  const hidden = hiddenFields(def, session);
  const record = doc as Record<string, unknown>;
  if (
    hidden.length === 0 ||
    (def.ownerField && record[def.ownerField] === session.userId)
  ) {
    return doc;
  }
  const visible = { ...record };
  for (const name of hidden) delete visible[name];
  return visible as T;
}

/** A positive integer query value, or `fallback` if it's missing or invalid. */
function positiveInt(value: string | undefined, fallback: number): number {
  const n = parseInt(value ?? '', 10);
  return n > 0 ? n : fallback;
}

// --- Routes ---

api.get('/models', (c) => {
  const models = Object.entries(modelRegistry).map(([name, def]) => ({
    name,
    fields: def.fields,
    ownerOnly: def.ownerOnly ?? false,
    readOnly: def.readOnly ?? false,
  }));
  return c.json(models);
});

api.get('/stats', async (c) => {
  const session = c.get('session');
  const ownerFilter = seesAllPrivate(session) ? {} : { userId: session.userId };

  const entries = Object.entries(modelRegistry);
  const [counts, activeReminders, activeDdays] = await Promise.all([
    Promise.all(
      entries.map(([, def]) => {
        const filter = privacyFilter(def, session);
        return Object.keys(filter).length
          ? def.model.countDocuments(filter)
          : // Unfiltered totals come from collection metadata instead of a scan
            def.model.estimatedDocumentCount();
      }),
    ),
    Reminder.countDocuments({
      triggerAt: { $gt: new Date() },
      ...ownerFilter,
    }),
    DDay.countDocuments({ completed: false, ...ownerFilter }),
  ]);

  const stats: Record<string, unknown> = {};
  entries.forEach(([name], i) => {
    stats[name] = counts[i];
  });
  stats.activeReminders = activeReminders;
  stats.activeDdays = activeDdays;

  return c.json(stats);
});

api.get('/uptime', async (c) => c.json(await getBotUptime()));

// Only the fields the dashboard's activity feed summarizes
const ACTIVITY_PROJECTION = {
  title: 1,
  content: 1,
  nickname: 1,
  username: 1,
  name: 1,
  updatedAt: 1,
};

api.get('/activity', async (c) => {
  const session = c.get('session');

  const perModel = await Promise.all(
    Object.entries(modelRegistry).map(async ([name, def]) => {
      const projection = def.ownerField
        ? { ...ACTIVITY_PROJECTION, [def.ownerField]: 1 }
        : ACTIVITY_PROJECTION;
      const docs = await def.model
        .find(privacyFilter(def, session), projection)
        .sort({ updatedAt: -1 })
        .limit(5)
        .lean();
      return docs.map((doc) => ({
        model: name,
        doc: withoutHidden(def, session, doc),
      }));
    }),
  );
  const items = perModel.flat();

  items.sort((a, b) => {
    const aDate = (a.doc as { updatedAt?: Date }).updatedAt?.getTime() ?? 0;
    const bDate = (b.doc as { updatedAt?: Date }).updatedAt?.getTime() ?? 0;
    return bDate - aDate;
  });

  return c.json(items.slice(0, 20));
});

// Not in the model registry: its documents are daily counters, not records.
// Registered before `/analytics/:model` so it takes precedence.
api.get('/analytics/translations', async (c) =>
  c.json(
    await getTranslationCounts({
      groupBy: c.req.query('groupBy'),
      dateFrom: c.req.query('dateFrom'),
      dateTo: c.req.query('dateTo'),
    }),
  ),
);

api.get('/analytics/:model', async (c) => {
  const modelName = c.req.param('model');
  const def = getModelDef(modelName);
  if (!def) return c.json({ error: 'Model not found' }, 404);

  const session = c.get('session');
  const groupBy = c.req.query('groupBy') ?? 'day';
  const dateFrom = c.req.query('dateFrom');
  const dateTo = c.req.query('dateTo');

  // Privacy filtering — analytics only cover records the user may see
  const match: Record<string, unknown> = privacyFilter(def, session);

  if (dateFrom || dateTo) {
    match.createdAt = {};
    if (dateFrom)
      (match.createdAt as Record<string, unknown>).$gte = new Date(dateFrom);
    if (dateTo)
      (match.createdAt as Record<string, unknown>).$lte = new Date(dateTo);
  }

  const dateFormat: Record<string, string> = {
    day: '%Y-%m-%d',
    week: '%Y-W%V',
    month: '%Y-%m',
  };

  const pipeline = [
    ...(Object.keys(match).length ? [{ $match: match }] : []),
    {
      $group: {
        _id: {
          $dateToString: {
            format: dateFormat[groupBy] ?? dateFormat.day,
            date: '$createdAt',
          },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 as const } },
  ];

  const results = await def.model.aggregate(pipeline);

  return c.json(
    results.map((r: { _id: string; count: number }) => ({
      date: r._id,
      count: r.count,
    })),
  );
});

api.get('/:model', async (c) => {
  const modelName = c.req.param('model');
  const def = getModelDef(modelName);
  if (!def) return c.json({ error: 'Model not found' }, 404);

  const session = c.get('session');
  const page = positiveInt(c.req.query('page'), 1);
  // MongoDB treats a limit of 0 as no limit, so it must stay at least 1
  const limit = Math.min(positiveInt(c.req.query('limit'), 25), 100);
  const search = c.req.query('search') ?? '';
  // Sorting by a hidden field would reveal its order
  const hidden = hiddenFields(def, session);
  const validFields = new Set(
    def.fields.map((f) => f.name).filter((name) => !hidden.includes(name)),
  );
  const requestedSort = c.req.query('sortField') ?? 'createdAt';
  const sortField = validFields.has(requestedSort)
    ? requestedSort
    : 'createdAt';
  const sortOrder = c.req.query('sortOrder') === 'asc' ? 1 : -1;

  // Privacy filtering — only records the user may see
  const query: Record<string, unknown> = privacyFilter(def, session);

  // The caller's own records: `mine=true` matches on the owner field, and
  // `mine=<field>` on another Discord ID field (e.g. a quote's `authorId`)
  const mine = c.req.query('mine');
  if (mine) {
    const mineField =
      mine === 'true'
        ? def.ownerField
        : def.fields.find((f) => f.snowflake && f.name === mine)?.name;
    if (!mineField) return c.json({ error: `Invalid mine: ${mine}` }, 400);
    query[mineField] = session.userId;
  }

  if (search) {
    const escaped = escapeRegex(search);
    const stringFields = def.fields
      .filter((f) => f.type === 'string' && !f.readOnly)
      .map((f) => ({ [f.name]: { $regex: escaped, $options: 'i' } }));
    if (stringFields.length) {
      query.$or = stringFields;
    }
  }

  const [docs, total] = await Promise.all([
    def.model
      .find(query)
      .sort({ [sortField]: sortOrder })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    def.model.countDocuments(query),
  ]);

  return c.json({
    docs: docs.map((doc) => withoutHidden(def, session, doc)),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
});

api.get('/:model/:id', async (c) => {
  const modelName = c.req.param('model');
  const def = getModelDef(modelName);
  if (!def) return c.json({ error: 'Model not found' }, 404);

  // Another user's private record is reported as missing
  const session = c.get('session');
  const doc = await def.model
    .findOne({ _id: c.req.param('id'), ...privacyFilter(def, session) })
    .lean();
  if (!doc) return c.json({ error: 'Not found' }, 404);

  return c.json(withoutHidden(def, session, doc));
});

api.post('/:model', async (c) => {
  const modelName = c.req.param('model');
  const def = getModelDef(modelName);
  if (!def) return c.json({ error: 'Model not found' }, 404);

  const session = c.get('session');
  if (!canWrite(session, modelName)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const body = await readBody(c);
  if (!body) return c.json({ error: 'Body must be a JSON object' }, 400);
  if (!sanitize(body)) return c.json({ error: 'Invalid input' }, 400);

  const filtered = filterFields(modelName, body);
  const badId = invalidIdField(modelName, filtered);
  if (badId) return c.json({ error: `${badId} must be a Discord ID` }, 400);

  // The dashboard manages a single guild, so guild-scoped records always
  // belong to it. Otherwise the bot could be pointed at other servers.
  if (def.fields.some((f) => f.name === 'guildId')) {
    filtered.guildId = config.guildId;
  }

  // Only the owner may create a private record for someone else; for anyone
  // else it belongs to them
  if (def.hasPrivacy && def.ownerField && !seesAllPrivate(session)) {
    filtered[def.ownerField] = session.userId;
  }

  const doc = await def.model.create(filtered);
  return c.json(doc, 201);
});

api.put('/:model/:id', async (c) => {
  const modelName = c.req.param('model');
  const def = getModelDef(modelName);
  if (!def) return c.json({ error: 'Model not found' }, 404);

  const session = c.get('session');
  if (!canWrite(session, modelName)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Ownership check for models with privacy
  if (def.hasPrivacy && def.ownerField && !seesAllPrivate(session)) {
    const existing = await def.model.findById(c.req.param('id')).lean();
    if (!existing) return c.json({ error: 'Not found' }, 404);
    const ownerValue = (existing as Record<string, unknown>)[def.ownerField];
    if (ownerValue !== session.userId) {
      return c.json({ error: 'Forbidden' }, 403);
    }
  }

  const body = await readBody(c);
  if (!body) return c.json({ error: 'Body must be a JSON object' }, 400);
  if (!sanitize(body)) return c.json({ error: 'Invalid input' }, 400);

  const filtered = filterFields(modelName, body);
  // Only the owner may hand a private record to someone else
  if (def.hasPrivacy && def.ownerField && !seesAllPrivate(session)) {
    delete filtered[def.ownerField];
  }
  const badId = invalidIdField(modelName, filtered);
  if (badId) return c.json({ error: `${badId} must be a Discord ID` }, 400);

  // Validators (required, enum, maxlength) don't run on updates by default
  const doc = await def.model.findByIdAndUpdate(c.req.param('id'), filtered, {
    returnDocument: 'after',
    runValidators: true,
  });
  if (!doc) return c.json({ error: 'Not found' }, 404);

  return c.json(doc);
});

api.delete('/:model/:id', async (c) => {
  const modelName = c.req.param('model');
  const def = getModelDef(modelName);
  if (!def) return c.json({ error: 'Model not found' }, 404);

  const session = c.get('session');
  if (!canWrite(session, modelName)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Ownership check for models with privacy
  if (def.hasPrivacy && def.ownerField && !seesAllPrivate(session)) {
    const existing = await def.model.findById(c.req.param('id')).lean();
    if (!existing) return c.json({ error: 'Not found' }, 404);
    const ownerValue = (existing as Record<string, unknown>)[def.ownerField];
    if (ownerValue !== session.userId) {
      return c.json({ error: 'Forbidden' }, 403);
    }
  }

  const doc = await def.model.findByIdAndDelete(c.req.param('id'));
  if (!doc) return c.json({ error: 'Not found' }, 404);

  return c.json({ deleted: true });
});

export { api };
