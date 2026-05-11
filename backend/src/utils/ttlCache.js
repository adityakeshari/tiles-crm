const cacheStore = new Map();

export async function getOrSetCache(key, ttlMs, loader) {
  const now = Date.now();
  const cached = cacheStore.get(key);

  if (cached && cached.expiresAt > now && "value" in cached) {
    return cached.value;
  }

  if (cached?.inflight) {
    return cached.inflight;
  }

  const inflight = Promise.resolve()
    .then(loader)
    .then((value) => {
      cacheStore.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
      });
      return value;
    })
    .catch((error) => {
      cacheStore.delete(key);
      throw error;
    });

  cacheStore.set(key, {
    inflight,
    expiresAt: now + ttlMs,
  });

  return inflight;
}

export function invalidateCachePrefix(prefix) {
  for (const key of cacheStore.keys()) {
    if (key.startsWith(prefix)) {
      cacheStore.delete(key);
    }
  }
}
