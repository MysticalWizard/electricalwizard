import { EventEmitter } from 'node:events';
import type { ChangeAction } from '#/services/changeFeed.js';

export interface DbChangeEvent {
  model: string;
  action: ChangeAction;
  id?: string | undefined;
  /** Owners of the changed records (see ChangeEntry); not sent to browsers. */
  userIds?: string[] | undefined;
  timestamp: number;
}

const bus = new EventEmitter();
bus.setMaxListeners(50);

export function emitDbChange(
  model: string,
  action: ChangeAction,
  id?: string,
  userIds?: string[],
): void {
  bus.emit('db:change', {
    model,
    action,
    id,
    userIds,
    timestamp: Date.now(),
  });
}

export { bus as eventBus };
