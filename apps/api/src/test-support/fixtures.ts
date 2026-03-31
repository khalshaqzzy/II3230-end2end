import { generateKeyPairSync, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  type AppEnv,
  type MessagePayload,
  SIGNATURE_INPUT_VERSION,
  buildCanonicalSignatureInput,
  defaultAlgorithmProfile,
  defaultEncodingMetadata,
  encryptPlaintext,
  generateSymmetricKey,
  hashPlaintext,
  signBytes,
  wrapSymmetricKey,
} from '@ii3230/shared';

import { createApp } from '../app';
import { createLogger } from '../logger';
import { createAppRuntime } from '../runtime/create-app-runtime';

interface GeneratedKeyPair {
  privateKeyPem: string;
  publicKeyPem: string;
}

export interface TestKeys {
  alice: GeneratedKeyPair;
  bob: GeneratedKeyPair;
  alternateBob: GeneratedKeyPair;
}

export interface TestHarness {
  app: ReturnType<typeof createApp>;
  env: AppEnv;
  keys: TestKeys;
  runtime: ReturnType<typeof createAppRuntime>;
  dbPath: string;
  createPayload: (input?: {
    plaintext?: string;
    messageId?: string;
    encryptedKeyPublicKeyPem?: string;
    signaturePrivateKeyPem?: string;
  }) => {
    payload: MessagePayload;
    plaintext: string;
  };
  cleanup: () => void;
}

const createKeyPair = (): GeneratedKeyPair => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  return {
    privateKeyPem: privateKey,
    publicKeyPem: publicKey,
  };
};

const writeKeyPair = (
  baseDir: string,
  actor: string,
  keyPair: GeneratedKeyPair,
) => {
  const actorDir = path.join(baseDir, actor);
  fs.mkdirSync(actorDir, { recursive: true });
  fs.writeFileSync(path.join(actorDir, 'private.pem'), keyPair.privateKeyPem);
  fs.writeFileSync(path.join(actorDir, 'public.pem'), keyPair.publicKeyPem);
};

export const createTestHarness = (): TestHarness => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ii3230-api-'));
  const keysDir = path.join(tempRoot, 'keys');
  const dataDir = path.join(tempRoot, 'data');
  fs.mkdirSync(keysDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });

  const keys: TestKeys = {
    alice: createKeyPair(),
    bob: createKeyPair(),
    alternateBob: createKeyPair(),
  };

  writeKeyPair(keysDir, 'alice', keys.alice);
  writeKeyPair(keysDir, 'bob', keys.bob);
  writeKeyPair(keysDir, 'alternate-bob', keys.alternateBob);

  const env: AppEnv = {
    PORT: 4000,
    LOG_LEVEL: 'fatal',
    APP_ENV: 'test',
    APP_DATA_DIR: dataDir,
    ALICE_LOGICAL_IP: '10.10.0.2',
    BOB_LOGICAL_IP: '10.10.0.3',
    ALICE_PRIVATE_KEY_PATH: path.join(keysDir, 'alice', 'private.pem'),
    ALICE_PUBLIC_KEY_PATH: path.join(keysDir, 'alice', 'public.pem'),
    BOB_PRIVATE_KEY_PATH: path.join(keysDir, 'bob', 'private.pem'),
    BOB_PUBLIC_KEY_PATH: path.join(keysDir, 'bob', 'public.pem'),
  };

  const logger = createLogger(env);
  const runtime = createAppRuntime({ env, logger });
  const app = createApp({ env, logger, runtime });

  return {
    app,
    env,
    keys,
    runtime,
    dbPath: path.join(dataDir, 'ii3230.sqlite'),
    createPayload: (input) => {
      const plaintext =
        input?.plaintext ?? 'Bob, ini pesan uji lokal yang valid.';
      const messageId = input?.messageId ?? randomUUID();
      const symmetricKey = generateSymmetricKey();
      const encrypted = encryptPlaintext(plaintext, symmetricKey);
      const plaintextHashHex = hashPlaintext(plaintext);
      const payloadWithoutSignature = {
        messageId,
        senderId: 'alice',
        recipientId: 'bob',
        sourceIp: env.ALICE_LOGICAL_IP,
        destinationIp: env.BOB_LOGICAL_IP,
        timestamp: new Date().toISOString(),
        algorithms: defaultAlgorithmProfile,
        ivB64: encrypted.ivB64,
        authTagB64: encrypted.authTagB64,
        ciphertextB64: encrypted.ciphertextB64,
        encryptedSymmetricKeyB64: wrapSymmetricKey(
          symmetricKey,
          input?.encryptedKeyPublicKeyPem ?? keys.bob.publicKeyPem,
        ),
        plaintextHashHex,
        signatureInputVersion: SIGNATURE_INPUT_VERSION,
        signatureB64: '',
        encoding: defaultEncodingMetadata,
      } satisfies MessagePayload;

      const signatureB64 = signBytes({
        payload: buildCanonicalSignatureInput(payloadWithoutSignature),
        privateKeyPem:
          input?.signaturePrivateKeyPem ?? keys.alice.privateKeyPem,
      });

      return {
        plaintext,
        payload: {
          ...payloadWithoutSignature,
          signatureB64,
        },
      };
    },
    cleanup: () => {
      runtime.close();
      fs.rmSync(tempRoot, { recursive: true, force: true });
    },
  };
};
