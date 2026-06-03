import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { getSession, type Session } from '../middleware/session.js';
import { modelRegistry } from '../utils/models.js';
import { emitDbChange } from '../utils/eventBus.js';

const api = new Hono();

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

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function filterFields(
  modelName: string,
  body: Record<string, unknown>,
): Record<string, unknown> {
  const def = modelRegistry[modelName];
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

function canWrite(session: Session, modelName: string): boolean {
  const def = modelRegistry[modelName];
  if (!def) return false;
  if (def.readOnly) return false;
  if (def.ownerOnly) return session.role === 'owner';
  return session.role === 'admin' || session.role === 'owner';
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
  const session = getSession(c)!;
  const isPrivileged = session.role === 'admin' || session.role === 'owner';

  const stats: Record<string, unknown> = {};
  for (const [name, def] of Object.entries(modelRegistry)) {
    // Privacy filtering — members only count their own records
    const filter: Record<string, unknown> = {};
    if (def.hasPrivacy && def.ownerField && !isPrivileged) {
      filter[def.ownerField] = session.userId;
    }
    stats[name] = await def.model.countDocuments(filter);
  }

  const { Reminder } = await import('@/models/Reminder.js');
  const { DDay } = await import('@/models/DDay.js');
  stats.activeReminders = await Reminder.countDocuments({
    triggerAt: { $gt: new Date() },
    ...(isPrivileged ? {} : { userId: session.userId }),
  });
  stats.activeDdays = await DDay.countDocuments({
    completed: false,
    ...(isPrivileged ? {} : { userId: session.userId }),
  });

  return c.json(stats);
});

api.get('/activity', async (c) => {
  const session = getSession(c)!;
  const items: { model: string; doc: unknown }[] = [];

  for (const [name, def] of Object.entries(modelRegistry)) {
    const query: Record<string, unknown> = {};
    if (
      def.hasPrivacy &&
      def.ownerField &&
      session.role !== 'admin' &&
      session.role !== 'owner'
    ) {
      query[def.ownerField] = session.userId;
    }
    const docs = await def.model
      .find(query)
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean();
    for (const doc of docs) {
      items.push({ model: name, doc });
    }
  }

  items.sort((a, b) => {
    const aDate = (a.doc as { updatedAt?: Date }).updatedAt?.getTime() ?? 0;
    const bDate = (b.doc as { updatedAt?: Date }).updatedAt?.getTime() ?? 0;
    return bDate - aDate;
  });

  return c.json(items.slice(0, 20));
});

api.get('/analytics/:model', async (c) => {
  const modelName = c.req.param('model');
  const def = modelRegistry[modelName];
  if (!def) return c.json({ error: 'Model not found' }, 404);

  const session = getSession(c)!;
  const groupBy = c.req.query('groupBy') ?? 'day';
  const dateFrom = c.req.query('dateFrom');
  const dateTo = c.req.query('dateTo');

  const match: Record<string, unknown> = {};

  // Privacy filtering — members only see analytics over their own records
  if (
    def.hasPrivacy &&
    def.ownerField &&
    session.role !== 'admin' &&
    session.role !== 'owner'
  ) {
    match[def.ownerField] = session.userId;
  }

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
  const def = modelRegistry[modelName];
  if (!def) return c.json({ error: 'Model not found' }, 404);

  const session = getSession(c)!;
  const page = parseInt(c.req.query('page') ?? '1', 10);
  const limit = Math.min(parseInt(c.req.query('limit') ?? '25', 10), 100);
  const search = c.req.query('search') ?? '';
  const validFields = new Set(def.fields.map((f) => f.name));
  const requestedSort = c.req.query('sortField') ?? 'createdAt';
  const sortField = validFields.has(requestedSort)
    ? requestedSort
    : 'createdAt';
  const sortOrder = c.req.query('sortOrder') === 'asc' ? 1 : -1;

  const query: Record<string, unknown> = {};

  // Privacy filtering
  if (def.hasPrivacy && def.ownerField) {
    if (session.role !== 'admin' && session.role !== 'owner') {
      query[def.ownerField] = session.userId;
    }
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

  return c.json({ docs, total, page, limit, pages: Math.ceil(total / limit) });
});

api.get('/:model/:id', async (c) => {
  const modelName = c.req.param('model');
  const def = modelRegistry[modelName];
  if (!def) return c.json({ error: 'Model not found' }, 404);

  const doc = await def.model.findById(c.req.param('id')).lean();
  if (!doc) return c.json({ error: 'Not found' }, 404);

  const session = getSession(c)!;
  if (
    def.hasPrivacy &&
    def.ownerField &&
    session.role !== 'admin' &&
    session.role !== 'owner'
  ) {
    const ownerValue = (doc as Record<string, unknown>)[def.ownerField];
    if (ownerValue !== session.userId)
      return c.json({ error: 'Not found' }, 404);
  }

  return c.json(doc);
});

api.post('/:model', async (c) => {
  const modelName = c.req.param('model');
  const def = modelRegistry[modelName];
  if (!def) return c.json({ error: 'Model not found' }, 404);

  const session = getSession(c)!;
  if (!canWrite(session, modelName)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const body = await c.req.json<Record<string, unknown>>();
  if (!sanitize(body)) return c.json({ error: 'Invalid input' }, 400);

  const filtered = filterFields(modelName, body);
  const doc = await def.model.create(filtered);
  const id = String((doc as { _id: unknown })._id);

  emitDbChange(modelName, 'create', id);
  return c.json(doc, 201);
});

api.put('/:model/:id', async (c) => {
  const modelName = c.req.param('model');
  const def = modelRegistry[modelName];
  if (!def) return c.json({ error: 'Model not found' }, 404);

  const session = getSession(c)!;
  if (!canWrite(session, modelName)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Ownership check for models with privacy
  if (def.hasPrivacy && def.ownerField && session.role !== 'owner') {
    const existing = await def.model.findById(c.req.param('id')).lean();
    if (!existing) return c.json({ error: 'Not found' }, 404);
    const ownerValue = (existing as Record<string, unknown>)[def.ownerField];
    if (ownerValue !== session.userId) {
      return c.json({ error: 'Forbidden' }, 403);
    }
  }

  const body = await c.req.json<Record<string, unknown>>();
  if (!sanitize(body)) return c.json({ error: 'Invalid input' }, 400);

  const filtered = filterFields(modelName, body);
  const doc = await def.model.findByIdAndUpdate(c.req.param('id'), filtered, {
    new: true,
  });
  if (!doc) return c.json({ error: 'Not found' }, 404);

  emitDbChange(modelName, 'update', c.req.param('id'));
  return c.json(doc);
});

api.delete('/:model/:id', async (c) => {
  const modelName = c.req.param('model');
  const def = modelRegistry[modelName];
  if (!def) return c.json({ error: 'Model not found' }, 404);

  const session = getSession(c)!;
  if (!canWrite(session, modelName)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Ownership check for models with privacy
  if (def.hasPrivacy && def.ownerField && session.role !== 'owner') {
    const existing = await def.model.findById(c.req.param('id')).lean();
    if (!existing) return c.json({ error: 'Not found' }, 404);
    const ownerValue = (existing as Record<string, unknown>)[def.ownerField];
    if (ownerValue !== session.userId) {
      return c.json({ error: 'Forbidden' }, 403);
    }
  }

  const doc = await def.model.findByIdAndDelete(c.req.param('id'));
  if (!doc) return c.json({ error: 'Not found' }, 404);

  emitDbChange(modelName, 'delete', c.req.param('id'));
  return c.json({ deleted: true });
});

export { api };
