import type { mongo } from 'mongoose';

// Additive and repeatable: does not rewrite records or drop existing indexes.
export async function up(db: mongo.Db): Promise<void> {
  await db.collection('doctorslots').createIndex({ doctorId: 1, startTime: 1 }, { unique: true });
  await db.collection('doctorslots').createIndex({ mutationId: 1 }, { unique: true });
  await db.collection('consultationchats').createIndex({ messageId: 1 }, { unique: true });
  await db.collection('consultationchats').createIndex({ appointmentId: 1 });
  await db.collection('prescriptions').createIndex({ mutationId: 1 }, { unique: true, sparse: true });
}
