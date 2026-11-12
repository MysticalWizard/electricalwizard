/**
 * Wrap `load` so each key's result is reused for `ttlMs`. Concurrent calls
 * share one load, and a failed load isn't kept. Keys should come from a small
 * set (such as guild IDs), since entries are only replaced, never evicted.
 */
export function cacheFor<V, K = void>(
  ttlMs: number,
  load: (key: K) => Promise<V>,
): (key: K) => Promise<V> {
  const entries = new Map<K, { value: Promise<V>; expires: number }>();
  return (key) => {
    const now = Date.now();
    const hit = entries.get(key);
    if (hit && hit.expires > now) return hit.value;

    const value = load(key);
    entries.set(key, { value, expires: now + ttlMs });
    value.catch(() => {
      if (entries.get(key)?.value === value) entries.delete(key);
    });
    return value;
  };
}
