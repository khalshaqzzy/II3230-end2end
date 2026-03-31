import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import type { AppEnv } from '@ii3230/shared';

import { resolveProjectPath } from '../runtime/project-path';
import * as schema from './schema';

export interface DatabaseClient {
  db: ReturnType<typeof drizzle<typeof schema>>;
  sqlite: Database.Database;
  dbPath: string;
  close: () => void;
}

export const createDatabaseClient = (env: AppEnv): DatabaseClient => {
  const dataDir = resolveProjectPath(env.APP_DATA_DIR);
  fs.mkdirSync(dataDir, { recursive: true });

  const dbPath = path.resolve(dataDir, 'ii3230.sqlite');
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  return {
    db: drizzle(sqlite, { schema }),
    sqlite,
    dbPath,
    close: () => sqlite.close(),
  };
};
