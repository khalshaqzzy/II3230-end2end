import type { AppEnv } from '@ii3230/shared';
import type { Logger } from 'pino';

import { createDatabaseClient } from '../db/client';
import { runDatabaseMigrations } from '../db/migrate';
import { createMessageCommandService } from '../modules/alice/orchestrator';
import { createAliceService } from '../modules/alice/service';
import { createBobTransportClient } from '../modules/alice/transport';
import { createBobService } from '../modules/bob/service';
import { createMessageRepository } from '../modules/messages/repository';
import { createMessageQueryService } from '../modules/messages/service';
import {
  type RuntimeKeyMaterial,
  loadRuntimeKeyMaterial,
} from './load-key-material';

export interface AppRuntime {
  messageCommandService: ReturnType<typeof createMessageCommandService>;
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

  const repository = createMessageRepository(databaseClient);
  const aliceService = createAliceService({
    env: input.env,
    keyMaterial,
  });
  const bobTransportClient = createBobTransportClient({
    logger: input.logger,
  });

  return {
    messageCommandService: createMessageCommandService({
      env: input.env,
      aliceService,
      bobTransportClient,
      repository,
      logger: input.logger,
    }),
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
