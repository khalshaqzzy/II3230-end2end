import type { AppEnv } from '@ii3230/shared';
import type { Logger } from 'pino';

import { createDatabaseClient } from '../db/client';
import { runDatabaseMigrations } from '../db/migrate';
import { createBobRepository } from '../modules/bob/repository';
import { createBobService } from '../modules/bob/service';
import { createMessageQueryService } from '../modules/messages/service';
import {
  type RuntimeKeyMaterial,
  loadRuntimeKeyMaterial,
} from './load-key-material';

export interface AppRuntime {
  bobService: ReturnType<typeof createBobService>;
  messageQueryService: ReturnType<typeof createMessageQueryService>;
  keyMaterial: RuntimeKeyMaterial;
  close: () => void;
}

export const createAppRuntime = (input: {
  env: AppEnv;
  logger: Logger;
}): AppRuntime => {
  const keyMaterial = loadRuntimeKeyMaterial(input.env);
  const databaseClient = createDatabaseClient(input.env);

  runDatabaseMigrations(databaseClient);

  const repository = createBobRepository(databaseClient);

  return {
    bobService: createBobService({
      keyMaterial,
      repository,
      logger: input.logger,
    }),
    messageQueryService: createMessageQueryService({
      repository,
    }),
    keyMaterial,
    close: () => {
      databaseClient.close();
    },
  };
};
