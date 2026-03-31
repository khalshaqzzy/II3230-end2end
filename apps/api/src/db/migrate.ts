import path from 'node:path';

import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import type { DatabaseClient } from './client';

export const runDatabaseMigrations = (databaseClient: DatabaseClient) => {
  const migrationsFolder = path.resolve(__dirname, '..', '..', 'drizzle');
  migrate(databaseClient.db, {
    migrationsFolder,
  });
};
