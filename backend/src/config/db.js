import mongoose from 'mongoose';
import { env, assertSafeDatabaseName } from './env.js';

mongoose.set('strictQuery', true);

export async function connectDatabase(uri = env.mongoUri, dbName = env.dbName) {
  assertSafeDatabaseName(dbName);
  await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 10000 });
  // Make sure unique indexes (e.g. case-insensitive role names) exist before we accept writes.
  await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
  return mongoose.connection;
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
