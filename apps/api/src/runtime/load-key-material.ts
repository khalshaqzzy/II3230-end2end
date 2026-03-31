import fs from 'node:fs';

import type { AppEnv } from '@ii3230/shared';

import { resolveProjectPath } from './project-path';

export interface RuntimeKeyMaterial {
  alicePublicKeyPem: string;
  bobPrivateKeyPem: string;
}

const readRequiredFile = (filePath: string): string => {
  const resolvedPath = resolveProjectPath(filePath);
  return fs.readFileSync(resolvedPath, 'utf8');
};

export const loadRuntimeKeyMaterial = (env: AppEnv): RuntimeKeyMaterial => {
  return {
    alicePublicKeyPem: readRequiredFile(env.ALICE_PUBLIC_KEY_PATH),
    bobPrivateKeyPem: readRequiredFile(env.BOB_PRIVATE_KEY_PATH),
  };
};
