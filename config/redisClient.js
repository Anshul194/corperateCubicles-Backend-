import { createClient } from 'redis';
import dotenv from 'dotenv';
dotenv.config();

let redisClient;

// Wrap the client's `del` so that any key containing a glob `*` is expanded via
// SCAN before deletion. The codebase calls `redis.del("prefix*")` in ~85 places
// expecting pattern deletion, but Redis DEL does NOT support globs — those calls
// silently deleted nothing, so cached lists were never invalidated and stale data
// was served across the whole app. This wrapper makes those calls work as intended
// while leaving exact-key deletes untouched.
const installPatternDelete = (client) => {
  const originalDel = client.del.bind(client);

  client.del = async (keyOrKeys) => {
    const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
    const exact = [];
    let deleted = 0;

    for (const k of keys) {
      if (typeof k === 'string' && k.includes('*')) {
        // Expand the pattern with a non-blocking SCAN and delete matches in batches.
        let cursor = '0';
        do {
          const reply = await client.scan(cursor, { MATCH: k, COUNT: 250 });
          cursor = String(reply.cursor);
          if (reply.keys && reply.keys.length) {
            deleted += await originalDel(reply.keys);
          }
        } while (cursor !== '0');
      } else if (k !== undefined && k !== null) {
        exact.push(k);
      }
    }

    if (exact.length) deleted += await originalDel(exact);
    return deleted;
  };

  return client;
};

// In-memory stand-in used when Redis is not configured (e.g. local development).
// Implements exactly the subset of the redis client API this codebase calls
// (del/setEx/get/set/keys/exists/zAdd/zRangeByScore/zRemRangeByScore/on/connect)
// with TTL expiry and glob support, so every controller works unchanged without
// a Redis server. Production (env configured) still gets the real client below —
// previously a missing config THREW from initRedis(), which broke login entirely.
const createMemoryRedisStub = () => {
  const kv = new Map();     // key -> { value, expiresAt|null }
  const zsets = new Map();  // key -> Array<{ score, value }>

  const now = () => Date.now();
  const live = (k) => {
    const e = kv.get(k);
    if (!e) return null;
    if (e.expiresAt !== null && e.expiresAt <= now()) { kv.delete(k); return null; }
    return e;
  };
  const globToRegex = (glob) =>
    new RegExp('^' + glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');

  // Periodic sweep so expired keys don't accumulate; unref'd to not hold the process open.
  const sweeper = setInterval(() => {
    for (const k of kv.keys()) live(k);
  }, 60_000);
  if (sweeper.unref) sweeper.unref();

  return {
    isMemoryStub: true,
    on() { return this; },
    async connect() { return this; },
    async get(k) { const e = live(k); return e ? e.value : null; },
    async set(k, v, opts) {
      const ttl = opts && (opts.EX ?? opts.ex);
      kv.set(k, { value: String(v), expiresAt: ttl ? now() + ttl * 1000 : null });
      return 'OK';
    },
    async setEx(k, ttlSeconds, v) {
      kv.set(k, { value: String(v), expiresAt: now() + ttlSeconds * 1000 });
      return 'OK';
    },
    async exists(...keysArgs) {
      const keys = keysArgs.flat();
      return keys.reduce((n, k) => n + (live(k) ? 1 : 0), 0);
    },
    async keys(pattern) {
      const re = globToRegex(pattern);
      const out = [];
      for (const k of kv.keys()) if (live(k) && re.test(k)) out.push(k);
      return out;
    },
    async del(keyOrKeys) {
      const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
      let deleted = 0;
      for (const k of keys) {
        if (typeof k === 'string' && k.includes('*')) {
          const re = globToRegex(k);
          for (const existing of [...kv.keys()]) {
            if (re.test(existing)) { kv.delete(existing); deleted++; }
          }
          for (const existing of [...zsets.keys()]) {
            if (re.test(existing)) { zsets.delete(existing); deleted++; }
          }
        } else if (k !== undefined && k !== null) {
          if (kv.delete(k)) deleted++;
          if (zsets.delete(k)) deleted++;
        }
      }
      return deleted;
    },
    async zAdd(key, members) {
      const arr = zsets.get(key) || [];
      const list = Array.isArray(members) ? members : [members];
      for (const m of list) {
        const i = arr.findIndex((e) => e.value === m.value);
        if (i >= 0) arr[i] = { score: Number(m.score), value: m.value };
        else arr.push({ score: Number(m.score), value: m.value });
      }
      arr.sort((a, b) => a.score - b.score);
      zsets.set(key, arr);
      return list.length;
    },
    async zRangeByScore(key, min, max) {
      const lo = min === '-inf' ? -Infinity : Number(min);
      const hi = max === '+inf' ? Infinity : Number(max);
      return (zsets.get(key) || []).filter((e) => e.score >= lo && e.score <= hi).map((e) => e.value);
    },
    async zRemRangeByScore(key, min, max) {
      const lo = min === '-inf' ? -Infinity : Number(min);
      const hi = max === '+inf' ? Infinity : Number(max);
      const arr = zsets.get(key) || [];
      const keep = arr.filter((e) => e.score < lo || e.score > hi);
      zsets.set(key, keep);
      return arr.length - keep.length;
    },
  };
};

let warnedMemoryFallback = false;

const initRedis = async () => {
  if (!redisClient) {
    //console.log('🔄 Initializing Redis client...')
    if (!process.env.REDIS_HOST || !process.env.REDIS_PORT || !process.env.REDIS_PASSWORD) {
      if (!warnedMemoryFallback) {
        warnedMemoryFallback = true;
        console.warn('[REDIS] Not configured (REDIS_HOST/PORT/PASSWORD unset) — using in-memory fallback. Fine for local dev; configure Redis in production.');
      }
      redisClient = createMemoryRedisStub();
      return redisClient;
    }
    redisClient = createClient({
      socket: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
      password: process.env.REDIS_PASSWORD,
    });

    redisClient.on('error', (err) => {
      console.error('❌ Redis error:', err);
    });

    await redisClient.connect();
    installPatternDelete(redisClient);
    //console.log('✅ Redis connected');
  }

  return redisClient;
};

export { initRedis, redisClient };
