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
  type AliceSendKeyMaterial,
  type BobReceiveKeyMaterial,
  type RuntimeKeyMaterial,
  loadAliceSendKeyMaterial,
  loadBobReceiveKeyMaterial,
  loadRuntimeKeyMaterial,
} from './load-key-material';

export interface AppRuntime {
  messageCommandService: ReturnType<typeof createMessageCommandService> | null;
  bobService: ReturnType<typeof createBobService>;
  messageQueryService: ReturnType<typeof createMessageQueryService>;
  keyMaterial: {
    alice: AliceSendKeyMaterial | null;
    bob: BobReceiveKeyMaterial;
    monolith: RuntimeKeyMaterial | null;
  };
  close: () => void;
}

const maybeLoadAliceSendKeyMaterial = (env: AppEnv) => {
  if (
    !env.ALICE_PRIVATE_KEY_PATH ||
    !env.ALICE_PUBLIC_KEY_PATH ||
    !env.BOB_PUBLIC_KEY_PATH
  ) {
    return null;
  }

  return loadAliceSendKeyMaterial(env);
};

const maybeLoadMonolithKeyMaterial = (env: AppEnv) => {
  if (
    !env.ALICE_PRIVATE_KEY_PATH ||
    !env.ALICE_PUBLIC_KEY_PATH ||
    !env.BOB_PRIVATE_KEY_PATH ||
    !env.BOB_PUBLIC_KEY_PATH
  ) {
    return null;
  }

  return loadRuntimeKeyMaterial(env);
};

export const createAppRuntime = (input: {
  env: AppEnv;
  logger: Logger;
}): AppRuntime => {
  const bobKeyMaterial = loadBobReceiveKeyMaterial(input.env);
  const aliceKeyMaterial = maybeLoadAliceSendKeyMaterial(input.env);
  const monolithKeyMaterial = maybeLoadMonolithKeyMaterial(input.env);
  const databaseClient = createDatabaseClient(input.env);

  runDatabaseMigrations(databaseClient);

  const repository = createMessageRepository(databaseClient);
  const messageCommandService = aliceKeyMaterial
    ? createMessageCommandService({
        env: input.env,
        aliceService: createAliceService({
          env: input.env,
          keyMaterial: aliceKeyMaterial,
        }),
        bobTransportClient: createBobTransportClient({
          logger: input.logger,
        }),
        repository,
        logger: input.logger,
      })
    : null;

  return {
    messageCommandService,
    bobService: createBobService({
      keyMaterial: bobKeyMaterial,
      repository,
      logger: input.logger,
    }),
    messageQueryService: createMessageQueryService({
      repository,
    }),
    keyMaterial: {
      alice: aliceKeyMaterial,
      bob: bobKeyMaterial,
      monolith: monolithKeyMaterial,
    },
    close: () => {
      databaseClient.close();
    },
  };
};
