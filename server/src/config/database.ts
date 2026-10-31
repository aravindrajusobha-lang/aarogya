import mongoose, { Connection } from 'mongoose';
import { logger } from './logger.js';

export interface ReplicaSetStatus {
  connected: boolean;
  isReplicaSet: boolean;
  setName: string | null;
  hosts: string[];
  supportsTransactions: boolean;
  primary?: string;
  error?: string;
}

export async function verifyReplicaSet(conn: Connection = mongoose.connection): Promise<ReplicaSetStatus> {
  if (conn.readyState !== 1 || !conn.db) {
    return {
      connected: false,
      isReplicaSet: false,
      setName: null,
      hosts: [],
      supportsTransactions: false,
      error: 'Database not connected',
    };
  }

  try {
    const adminDb = conn.db.admin();
    const serverStatus = await adminDb.command({ hello: 1 }).catch(() => adminDb.command({ isMaster: 1 }));

    const isReplicaSet = Boolean(serverStatus.setName);
    const setName = serverStatus.setName || null;
    const hosts = serverStatus.hosts || [];
    const primary = serverStatus.primary;

    let supportsTransactions = false;

    if (isReplicaSet) {
      // Test starting a session and transaction
      const session = await conn.startSession();
      try {
        session.startTransaction();
        await session.abortTransaction();
        supportsTransactions = true;
      } catch (txErr) {
        logger.warn({
          event: 'replica_set_transaction_test_failed',
          error: (txErr as Error).message,
        });
      } finally {
        await session.endSession();
      }
    }

    return {
      connected: true,
      isReplicaSet,
      setName,
      hosts,
      supportsTransactions,
      primary,
    };
  } catch (err) {
    logger.error({
      event: 'replica_set_check_failed',
      error: (err as Error).message,
    });
    return {
      connected: true,
      isReplicaSet: false,
      setName: null,
      hosts: [],
      supportsTransactions: false,
      error: (err as Error).message,
    };
  }
}

export async function connectDatabase(uri?: string): Promise<Connection> {
  const mongoUri = uri || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aarogya_drishti?replicaSet=rs0';

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true,
    });

    const status = await verifyReplicaSet(mongoose.connection);
    logger.info({
      event: 'mongodb_connected',
      isReplicaSet: status.isReplicaSet,
      setName: status.setName,
      supportsTransactions: status.supportsTransactions,
    });

    if (!status.isReplicaSet) {
      logger.warn(
        'WARNING: Connected MongoDB is NOT running as a Replica Set. Multi-document transactions will not function in production!'
      );
    }

    return mongoose.connection;
  } catch (error) {
    logger.error({
      event: 'mongodb_connection_error',
      error: (error as Error).message,
    });
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    logger.info({ event: 'mongodb_disconnected' });
  }
}
