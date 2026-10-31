import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose, { Schema } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { verifyReplicaSet } from '../src/config/database.js';
import { createTestReplicaSet } from './setupReplSet.js';

interface ISimulationTxDoc {
  name: string;
  value: number;
}

const TxDocSchema = new Schema<ISimulationTxDoc>({
  name: { type: String, required: true },
  value: { type: Number, required: true },
});

const TxDoc = mongoose.models.TxDoc || mongoose.model<ISimulationTxDoc>('TxDoc', TxDocSchema);

describe('MongoDB Replica Set & Multi-Document Transactions', () => {
  let replSet: MongoMemoryReplSet;

  beforeAll(async () => {
    replSet = await createTestReplicaSet('rsTest');
    const uri = replSet.getUri();
    await mongoose.connect(uri);
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) {
      await replSet.stop();
    }
  });

  it('verifies connection is detected as a valid Replica Set', async () => {
    const status = await verifyReplicaSet(mongoose.connection);

    expect(status.connected).toBe(true);
    expect(status.isReplicaSet).toBe(true);
    expect(status.setName).toBe('rsTest');
    expect(status.supportsTransactions).toBe(true);
  });

  it('guarantees multi-document ACID rollback on transaction abort', async () => {
    const session = await mongoose.startSession();
    session.startTransaction();

    await TxDoc.create([{ name: 'item_rolled_back_1', value: 100 }], { session });
    await TxDoc.create([{ name: 'item_rolled_back_2', value: 200 }], { session });

    // Abort transaction
    await session.abortTransaction();
    await session.endSession();

    // Verify documents do NOT exist in the collection
    const count = await TxDoc.countDocuments({
      name: { $in: ['item_rolled_back_1', 'item_rolled_back_2'] },
    });
    expect(count).toBe(0);
  });

  it('guarantees multi-document ACID persistence on transaction commit', async () => {
    const session = await mongoose.startSession();
    session.startTransaction();

    await TxDoc.create([{ name: 'item_committed_1', value: 500 }], { session });
    await TxDoc.create([{ name: 'item_committed_2', value: 600 }], { session });

    // Commit transaction
    await session.commitTransaction();
    await session.endSession();

    // Verify documents DO exist in the collection
    const count = await TxDoc.countDocuments({
      name: { $in: ['item_committed_1', 'item_committed_2'] },
    });
    expect(count).toBe(2);
  });
});
