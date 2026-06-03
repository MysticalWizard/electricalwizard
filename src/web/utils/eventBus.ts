import { EventEmitter } from 'node:events';

export interface DbChangeEvent {
  model: string;
  action: 'create' | 'update' | 'delete';
  id: string;
  timestamp: number;
}

export interface BotStatusEvent {
  status: string;
  activityType: number | null;
  activityName: string;
  timestamp: number;
}

const bus = new EventEmitter();
bus.setMaxListeners(50);

export function emitDbChange(
  model: string,
  action: DbChangeEvent['action'],
  id: string,
): void {
  bus.emit('db:change', { model, action, id, timestamp: Date.now() });
}

export function emitBotStatus(
  status: string,
  activityType: number | null,
  activityName: string,
): void {
  bus.emit('bot:status', {
    status,
    activityType,
    activityName,
    timestamp: Date.now(),
  });
}

export { bus as eventBus };
