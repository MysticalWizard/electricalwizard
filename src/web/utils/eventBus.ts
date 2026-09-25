import { EventEmitter } from 'node:events';
import type { ChangeAction } from '#/services/changeFeed.js';

export interface DbChangeEvent {
  model: string;
  action: ChangeAction;
  id?: string | undefined;
  timestamp: number;
}

const bus = new EventEmitter();
bus.setMaxListeners(50);

export function emitDbChange(
  model: string,
  action: ChangeAction,
  id?: string,
): void {
  bus.emit('db:change', { model, action, id, timestamp: Date.now() });
}

export { bus as eventBus };
