import fs from 'node:fs';

import type { AppEnv } from '@ii3230/shared';

import { resolveProjectPath } from './project-path';

export interface RuntimeKeyMaterial {
  alicePrivateKeyPem: string;
  alicePublicKeyPem: string;
  bobPublicKeyPem: string;
  bobPrivateKeyPem: string;
}

const readRequiredFile = (filePath: string): string => {
  const resolvedPath = resolveProjectPath(filePath);
  return fs.readFileSync(resolvedPath, 'utf8');
};

export const loadRuntimeKeyMaterial = (env: AppEnv): RuntimeKeyMaterial => {
  return {
    alicePrivateKeyPem: readRequiredFile(env.ALICE_PRIVATE_KEY_PATH),
    alicePublicKeyPem: readRequiredFile(env.ALICE_PUBLIC_KEY_PATH),
    bobPublicKeyPem: readRequiredFile(env.BOB_PUBLIC_KEY_PATH),
    bobPrivateKeyPem: readRequiredFile(env.BOB_PRIVATE_KEY_PATH),
  };
};
