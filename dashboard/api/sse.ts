import type { SSEEvent } from '@electricalwizard/shared';

export function createSSEConnection(
  onEvent: (event: SSEEvent) => void,
): () => void {
  const source = new EventSource('/api/events');

  source.addEventListener('db:change', (e) => {
    try {
      onEvent({ type: 'db:change', data: JSON.parse(e.data) });
    } catch {
      /* malformed event data */
    }
  });

  source.addEventListener('bot:status', (e) => {
    try {
      onEvent({ type: 'bot:status', data: JSON.parse(e.data) });
    } catch {
      /* malformed event data */
    }
  });

  return () => source.close();
}
