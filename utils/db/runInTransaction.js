import mongoose from "mongoose";

// Whether the connected MongoDB supports multi-document transactions
// (replica set or sharded/mongos). Standalone mongod does NOT. Cached after the
// first probe.
let txnSupported = null;

export const supportsTransactions = async () => {
  if (txnSupported !== null) return txnSupported;
  try {
    const admin = mongoose.connection.db.admin();
    const info = await admin.command({ hello: 1 });
    // `setName` present => replica set member; msg 'isdbgrid' => mongos router.
    txnSupported = Boolean(info.setName) || info.msg === "isdbgrid";
  } catch (e) {
    txnSupported = false;
  }
  return txnSupported;
};

/**
 * Run `fn(session)` atomically inside a MongoDB transaction when the deployment
 * supports it; otherwise run `fn(null)` without a session (non-atomic fallback,
 * so the same code keeps working on a standalone mongod).
 *
 * Every DB operation inside `fn` MUST pass the provided `session` (which may be
 * null — Mongoose treats a null session as "no session", so identical code works
 * in both modes). On a transient/commit error the transaction aborts and rolls
 * back all writes, and `withTransaction` retries the callback.
 *
 * Keep side effects (emails, push notifications, PDF generation, HTTP calls) OUT
 * of `fn` — only put database writes that must commit together inside it.
 */
export const runInTransaction = async (fn) => {
  if (await supportsTransactions()) {
    const session = await mongoose.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        result = await fn(session);
      });
      return result;
    } finally {
      await session.endSession();
    }
  }
  return fn(null);
};

export default runInTransaction;
