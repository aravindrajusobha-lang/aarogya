import mongoose, { ClientSession } from 'mongoose';
import { verifyReplicaSet } from '../config/database.js';
import { logger } from '../config/logger.js';

let cachedSupport: boolean | null = null;
let warned = false;

async function transactionsSupported(): Promise<boolean> {
  if (cachedSupport !== null) return cachedSupport;
  try {
    cachedSupport = (await verifyReplicaSet(mongoose.connection)).supportsTransactions;
  } catch {
    cachedSupport = false;
  }
  return cachedSupport;
}

/**
 * Runs `work` inside a MongoDB multi-document transaction when the deployment supports it
 * (replica set / Atlas / tests). On a standalone development server — where MongoDB rejects
 * transactions ("Transaction numbers are only allowed on a replica set member or mongos") —
 * the same work runs without a session so local development keeps working.
 * Production deployments should always use a replica set (see docs/SETUP_GUIDE.md).
 */
export async function runInTransaction<T>(work: (session: ClientSession | null) => Promise<T>): Promise<T> {
  if (!(await transactionsSupported())) {
    if (!warned) {
      logger.warn({ event: 'transactions_unavailable' }, 'MongoDB is standalone; multi-document transactions are disabled. Use a replica set in production.');
      warned = true;
    }
    return work(null);
  }
  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => { result = await work(session); });
    return result;
  } finally {
    await session.endSession();
  }
}

/** Test hook: forget the cached capability check. */
export function resetTransactionSupportCache(): void { cachedSupport = null; warned = false; }
