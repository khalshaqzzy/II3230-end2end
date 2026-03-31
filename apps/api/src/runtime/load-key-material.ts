import fs from 'node:fs';

import type { AppEnv } from '@ii3230/shared';

import { resolveProjectPath } from './project-path';

export interface AliceSendKeyMaterial {
  alicePrivateKeyPem: string;
  alicePublicKeyPem: string;
  bobPublicKeyPem: string;
}

export interface BobReceiveKeyMaterial {
  alicePublicKeyPem: string;
  bobPrivateKeyPem: string;
  bobPublicKeyPem: string;
}

export interface RuntimeKeyMaterial
  extends AliceSendKeyMaterial,
    BobReceiveKeyMaterial {}

const getRequiredEnvPath = (
  env: AppEnv,
  envKey:
    | 'ALICE_PRIVATE_KEY_PATH'
    | 'ALICE_PUBLIC_KEY_PATH'
    | 'BOB_PRIVATE_KEY_PATH'
    | 'BOB_PUBLIC_KEY_PATH',
) => {
  const pathValue = env[envKey];

  if (!pathValue) {
    throw new Error(`${envKey} is required for this runtime path.`);
  }

  return pathValue;
};

const readRequiredFile = (filePath: string): string => {
  const resolvedPath = resolveProjectPath(filePath);
  return fs.readFileSync(resolvedPath, 'utf8');
};

export const loadAliceSendKeyMaterial = (env: AppEnv): AliceSendKeyMaterial => {
  return {
    alicePrivateKeyPem: readRequiredFile(
      getRequiredEnvPath(env, 'ALICE_PRIVATE_KEY_PATH'),
    ),
    alicePublicKeyPem: readRequiredFile(
      getRequiredEnvPath(env, 'ALICE_PUBLIC_KEY_PATH'),
    ),
    bobPublicKeyPem: readRequiredFile(
      getRequiredEnvPath(env, 'BOB_PUBLIC_KEY_PATH'),
    ),
  };
};

export const loadBobReceiveKeyMaterial = (
  env: AppEnv,
): BobReceiveKeyMaterial => {
  return {
    alicePublicKeyPem: readRequiredFile(
      getRequiredEnvPath(env, 'ALICE_PUBLIC_KEY_PATH'),
    ),
    bobPrivateKeyPem: readRequiredFile(
      getRequiredEnvPath(env, 'BOB_PRIVATE_KEY_PATH'),
    ),
    bobPublicKeyPem: readRequiredFile(
      getRequiredEnvPath(env, 'BOB_PUBLIC_KEY_PATH'),
    ),
  };
};

export const loadRuntimeKeyMaterial = (env: AppEnv): RuntimeKeyMaterial => {
  return {
    ...loadAliceSendKeyMaterial(env),
    ...loadBobReceiveKeyMaterial(env),
  };
};
