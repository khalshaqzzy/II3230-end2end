import { generateKeyPairSync } from 'node:crypto';
import { parseArgs } from 'node:util';

import { sanitizeArtifactDetails } from '@ii3230/shared';

import { createAliceService } from '../apps/api/src/modules/alice/service';
import { loadAliceSendKeyMaterial } from '../apps/api/src/runtime/load-key-material';
import {
  loadScriptEnv,
  printJson,
  resolveTargetBaseUrl,
  writeJsonOutput,
} from './support/cli';
import { fetchJson } from './support/http';
import {
  createTestRunId,
  createTestingHeaders,
} from './support/validation-artifacts';

const mutateEncodedValue = (value: string, replacements: [string, string]) => {
  if (value.length <= 1) {
    return `${value}${replacements[0]}`;
  }

  const midpoint = Math.min(
    Math.max(0, Math.floor(value.length / 2)),
    value.length - 1,
  );
  const currentCharacter = value.at(midpoint);
  const replacement =
    currentCharacter === replacements[0] ? replacements[1] : replacements[0];

  return `${value.slice(0, midpoint)}${replacement}${value.slice(midpoint + 1)}`;
};

const mutateBase64Value = (value: string) => {
  return mutateEncodedValue(value, ['A', 'B']);
};

const mutateHexValue = (value: string) => {
  return mutateEncodedValue(value, ['a', 'b']);
};

const { values } = parseArgs({
  options: {
    target: {
      type: 'string',
    },
    field: {
      type: 'string',
    },
    scenario: {
      type: 'string',
    },
    'message-id': {
      type: 'string',
    },
    message: {
      type: 'string',
    },
    output: {
      type: 'string',
    },
    'env-file': {
      type: 'string',
    },
    'test-run-id': {
      type: 'string',
    },
  },
});

if (!values.target) {
  throw new Error('--target is required.');
}

if (!values.field && !values.scenario) {
  throw new Error('--field or --scenario is required.');
}

if (values.field && values.scenario) {
  throw new Error('Use either --field or --scenario, not both.');
}

const supportedFields = new Set([
  'ciphertext',
  'hash',
  'signature',
  'encrypted-key',
]);
const supportedScenarios = new Set(['wrong-recipient-key']);

if (values.field && !supportedFields.has(values.field)) {
  throw new Error(
    '--field must be one of ciphertext, hash, signature, encrypted-key.',
  );
}

if (values.scenario && !supportedScenarios.has(values.scenario)) {
  throw new Error('--scenario must be wrong-recipient-key.');
}

const main = async () => {
  const env = loadScriptEnv({ envFile: values['env-file'] });
  const targetBaseUrl = resolveTargetBaseUrl(values.target, env);
  const testRunId = values['test-run-id'] ?? createTestRunId();
  let payload: Record<string, unknown>;

  if (values.scenario === 'wrong-recipient-key') {
    const { publicKey } = generateKeyPairSync('rsa', {
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
    const aliceService = createAliceService({
      env,
      keyMaterial: loadAliceSendKeyMaterial(env),
    });
    payload = structuredClone(
      aliceService.prepareMessage({
        plaintext: values.message ?? 'Bob, ini payload uji wrong recipient key.',
        bobPublicKeyPemOverride: publicKey,
      }).payload,
    ) as Record<string, unknown>;
  } else if (values['message-id']) {
    const detail = await fetchJson<{ payload: Record<string, unknown> }>({
      url: `${targetBaseUrl}/messages/${values['message-id']}`,
    });
    payload = structuredClone(detail.payload);
  } else {
    const aliceService = createAliceService({
      env,
      keyMaterial: loadAliceSendKeyMaterial(env),
    });
    payload = structuredClone(
      aliceService.prepareMessage({
        plaintext: values.message ?? 'Bob, ini payload uji tamper.',
      }).payload,
    ) as Record<string, unknown>;
  }

  switch (values.field ?? values.scenario) {
    case 'ciphertext':
      payload.ciphertextB64 = mutateBase64Value(String(payload.ciphertextB64));
      break;
    case 'hash':
      payload.plaintextHashHex = mutateHexValue(String(payload.plaintextHashHex));
      break;
    case 'signature':
      payload.signatureB64 = mutateBase64Value(String(payload.signatureB64));
      break;
    case 'encrypted-key':
      payload.encryptedSymmetricKeyB64 = mutateBase64Value(
        String(payload.encryptedSymmetricKeyB64),
      );
      break;
  }

  const response = await fetchJson({
    url: `${targetBaseUrl}/internal/messages/receive`,
    method: 'POST',
    body: payload,
    headers: createTestingHeaders({
      validationMode: 'manual_tamper',
      testRunId,
      scenario: values.scenario ?? values.field ?? 'manual-tamper',
    }),
  });

  const result = sanitizeArtifactDetails({
    targetBaseUrl,
    testRunId,
    field: values.field ?? null,
    scenario: values.scenario ?? null,
    payload,
    response,
  }) as Record<string, unknown>;

  writeJsonOutput(values.output, result);
  printJson(result);
};

void main().catch((error) => {
  throw error;
});
