import type { SSEEvent } from '@electricalwizard/shared';

let openStreams = 0;

/**
 * Whether the event stream is connected. While it is, the API echoes this
 * tab's own writes back as events, so mutations needn't refetch themselves.
 */
export function isLive(): boolean {
  return openStreams > 0;
}

export function createSSEConnection(
  onEvent: (event: SSEEvent) => void,
): () => void {
  const source = new EventSource('/api/events');

  // EventSource reconnects by itself, firing `error` on a drop and `open`
  // once it's back
  let open = false;
  const setOpen = (value: boolean) => {
    if (value === open) return;
    open = value;
    openStreams += value ? 1 : -1;
  };
  source.addEventListener('open', () => setOpen(true));
  source.addEventListener('error', () => setOpen(false));

  source.addEventListener('db:change', (e) => {
    try {
      onEvent({ type: 'db:change', data: JSON.parse(e.data) });
    } catch {
      /* malformed event data */
    }
  });

  return () => {
    source.close();
    setOpen(false);
  };
}
