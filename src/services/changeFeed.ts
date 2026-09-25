import mongoose, { type Model, type Schema, type mongo } from 'mongoose';

// Cross-process change notifications. The bot and the dashboard API run as
// separate processes, so writes are recorded in a capped collection that the
// API tails and forwards to dashboard clients over SSE. Capped collections
// work on a standalone MongoDB (unlike change streams, which need a replica
// set) and discard their oldest entries once full.
const COLLECTION = 'changefeed';
const SIZE_BYTES = 1024 * 1024;
const RETRY_DELAY_MS = 1000;

export type ChangeAction = 'create' | 'update' | 'delete';

export interface ChangeEntry {
  model: string;
  action: ChangeAction;
  id?: string | undefined;
  at: Date;
}

// A tailable cursor on an empty capped collection closes immediately, so the
// collection is created with this entry and it is skipped when reading.
interface SentinelEntry {
  sentinel: true;
}

type FeedDocument = (ChangeEntry | SentinelEntry) & { _id?: mongo.ObjectId };

function feed(): mongo.Collection<FeedDocument> {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Change feed used before connecting to MongoDB');
  return db.collection<FeedDocument>(COLLECTION);
}

/**
 * Create the capped collection if it doesn't exist yet. Must run before any
 * publish, because inserting into a missing collection creates an uncapped one
 * that can't be tailed.
 */
export async function ensureChangeFeed(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Change feed used before connecting to MongoDB');

  const existing = await db.listCollections({ name: COLLECTION }).toArray();
  if (existing.length === 0) {
    try {
      await db.createCollection(COLLECTION, { capped: true, size: SIZE_BYTES });
      await feed().insertOne({ sentinel: true });
    } catch (error) {
      // Another process created it first. Newer servers don't raise this and
      // both processes insert a sentinel, which is harmless.
      if ((error as { codeName?: string }).codeName !== 'NamespaceExists') {
        throw error;
      }
    }
  }

  if (!(await feed().isCapped())) {
    throw new Error(
      `MongoDB collection "${COLLECTION}" exists but is not capped; drop it so it can be recreated`,
    );
  }
}

function publish(model: string, action: ChangeAction, id?: unknown): void {
  // Omit `id` rather than setting it to undefined, which the driver stores as null.
  const entry: ChangeEntry = {
    model,
    action,
    ...(id == null ? {} : { id: String(id) }),
    at: new Date(),
  };
  // Notifications are best-effort: never fail the write that triggered them.
  feed()
    .insertOne(entry)
    .catch((error: unknown) => {
      console.error('Failed to publish change notification:', error);
    });
}

function idOf(result: unknown): unknown {
  return result && typeof result === 'object' && '_id' in result
    ? result._id
    : undefined;
}

/**
 * Mongoose plugin that publishes every write made through the model's
 * document and query methods to the change feed.
 */
export function changeFeedPlugin(schema: Schema): void {
  schema.pre('save', function () {
    this.$locals.wasNew = this.isNew;
  });

  schema.post('save', function (doc) {
    const { modelName } = doc.constructor as Model<unknown>;
    publish(modelName, doc.$locals.wasNew ? 'create' : 'update', doc._id);
  });

  schema.post(
    ['findOneAndUpdate', 'updateOne', 'updateMany'],
    function (result: unknown) {
      publish(this.model.modelName, 'update', idOf(result));
    },
  );

  schema.post(
    ['findOneAndDelete', 'deleteOne', 'deleteMany'],
    function (result: unknown) {
      publish(this.model.modelName, 'delete', idOf(result));
    },
  );
}

/**
 * Follow the change feed and call `onChange` for each new entry. Starts after
 * the newest existing entry and reconnects if the cursor closes. Runs until the
 * process exits.
 */
export async function watchChangeFeed(
  onChange: (entry: ChangeEntry) => void,
): Promise<never> {
  const newest = await feed().findOne({}, { sort: { $natural: -1 } });
  let lastId = newest?._id;

  for (;;) {
    try {
      const cursor = feed().find(lastId ? { _id: { $gt: lastId } } : {}, {
        tailable: true,
        awaitData: true,
      });
      for await (const doc of cursor) {
        lastId = doc._id;
        if (!('sentinel' in doc)) onChange(doc);
      }
    } catch (error) {
      console.error('Change feed cursor failed, retrying:', error);
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  }
}
