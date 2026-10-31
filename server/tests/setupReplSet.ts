import { MongoMemoryReplSet } from 'mongodb-memory-server';
import fs from 'fs';

const DEFAULT_WINDOWS_MONGOD = 'C:\\Program Files\\MongoDB\\Server\\8.3\\bin\\mongod.exe';

export async function createTestReplicaSet(name = 'rsTest'): Promise<MongoMemoryReplSet> {
  const binaryOptions: Record<string, unknown> = {};

  if (fs.existsSync(DEFAULT_WINDOWS_MONGOD)) {
    binaryOptions.systemBinary = DEFAULT_WINDOWS_MONGOD;
  }

  return await MongoMemoryReplSet.create({
    binary: binaryOptions,
    replSet: {
      count: 1,
      name,
    },
  });
}
