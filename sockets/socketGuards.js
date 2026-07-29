// Reusable per-socket guards for Socket.io event handlers.
//
// DoS hardening: the chat/progress handlers persist to Mongo and broadcast to
// whole rooms on every emit. Without a throttle, one authenticated socket can
// loop an emit thousands of times per second (websocket events never pass
// through the Express rate limiters). These helpers add:
//
//   1. consumeRateLimit(socket) — a token bucket per socket (shared across all
//      guarded event types): RATE_LIMIT_EVENTS events per RATE_LIMIT_WINDOW_MS,
//      refilled continuously. When exhausted, the offending socket receives a
//      'rate_limited' event (new, additive — clients without a listener simply
//      ignore it) plus the pre-existing 'error' event ({ message }) that all
//      clients already handle, and the handler must return without touching
//      the DB. Rejection notices are themselves throttled so the rejection
//      path cannot be used to generate traffic.
//
//   2. invalidStringField / validateStringFields — type + length validation
//      for client-supplied string fields before they are persisted (Message /
//      GroupMessage / CourseChatMessage schemas have no maxlength, so without
//      this a client could persist ~1MB strings on every event).
//
// State lives on socket.data so it is garbage-collected with the socket (same
// pattern as videoSocketHandler's per-socket throttle map). Event names and
// payload shapes consumed by existing clients are unchanged.

const RATE_LIMIT_EVENTS = 20; // bucket capacity (burst size)
const RATE_LIMIT_WINDOW_MS = 10 * 1000; // full-refill window => 20 events / 10s sustained
const REFILL_PER_MS = RATE_LIMIT_EVENTS / RATE_LIMIT_WINDOW_MS;
const NOTIFY_INTERVAL_MS = 1000; // at most one rejection notice per second

export const MAX_MESSAGE_CHARS = 10000; // cap on chat message content
export const MAX_FIELD_CHARS = 2048; // cap on auxiliary string fields (urls, names)

/**
 * Take one token from the socket's bucket.
 * @returns {boolean} true if the event may proceed; false if rate-limited
 *                    (the caller must return immediately).
 */
export function consumeRateLimit(socket) {
  const now = Date.now();
  let bucket = socket.data.rateBucket;
  if (!bucket) {
    bucket = { tokens: RATE_LIMIT_EVENTS, last: now, notifiedAt: 0 };
    socket.data.rateBucket = bucket;
  }

  bucket.tokens = Math.min(
    RATE_LIMIT_EVENTS,
    bucket.tokens + (now - bucket.last) * REFILL_PER_MS
  );
  bucket.last = now;

  if (bucket.tokens < 1) {
    if (now - bucket.notifiedAt >= NOTIFY_INTERVAL_MS) {
      bucket.notifiedAt = now;
      const retryAfterMs = Math.ceil((1 - bucket.tokens) / REFILL_PER_MS);
      socket.emit('rate_limited', {
        message: 'Too many events. Please slow down.',
        retryAfterMs
      });
      socket.emit('error', { message: 'Rate limit exceeded. Please slow down.' });
    }
    return false;
  }

  bucket.tokens -= 1;
  return true;
}

/**
 * Validate a single optional string field.
 * @returns {string|null} an error message, or null when the field is fine.
 *                        null/undefined values pass (fields are optional —
 *                        required-ness is enforced by the existing handlers).
 */
export function invalidStringField(value, fieldName, maxLen = MAX_MESSAGE_CHARS) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return `${fieldName} must be a string`;
  if (value.length > maxLen) {
    return `${fieldName} exceeds the maximum length of ${maxLen} characters`;
  }
  return null;
}

/**
 * Validate several fields at once. Emits the existing 'error' event
 * ({ message }) on the first failure.
 * @param {import('socket.io').Socket} socket
 * @param {Array<[string, unknown, number?]>} fields  [name, value, maxLen?]
 * @returns {boolean} true when all fields are acceptable.
 */
export function validateStringFields(socket, fields) {
  for (const [name, value, maxLen] of fields) {
    const problem = invalidStringField(value, name, maxLen);
    if (problem) {
      socket.emit('error', { message: problem });
      return false;
    }
  }
  return true;
}
