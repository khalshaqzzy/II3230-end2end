import { parseArgs } from 'node:util';

import { sanitizeArtifactDetails } from '@ii3230/shared';

import { createAliceService } from '../apps/api/src/modules/alice/service';
import { loadRuntimeKeyMaterial } from '../apps/api/src/runtime/load-key-material';
import {
  loadScriptEnv,
  printJson,
  resolveTargetBaseUrl,
  writeJsonOutput,
} from './support/cli';
import { fetchJson } from './support/http';

const mutateField = (value: string) => {
  if (value.length <= 1) {
    return `${value}A`;
  }

  return `${value.slice(0, -1)}${value.at(-1) === 'A' ? 'B' : 'A'}`;
};

const { values } = parseArgs({
  options: {
    target: {
      type: 'string',
    },
    field: {
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
  },
});

if (!values.target) {
  throw new Error('--target is required.');
}

if (!values.field) {
  throw new Error('--field is required.');
}

const supportedFields = new Set([
  'ciphertext',
  'hash',
  'signature',
  'encrypted-key',
]);

if (!supportedFields.has(values.field)) {
  throw new Error(
    '--field must be one of ciphertext, hash, signature, encrypted-key.',
  );
}

const env = loadScriptEnv();
const targetBaseUrl = resolveTargetBaseUrl(values.target, env);
let payload: Record<string, unknown>;

if (values['message-id']) {
  const detail = await fetchJson<{ payload: Record<string, unknown> }>({
    url: `${targetBaseUrl}/messages/${values['message-id']}`,
  });
  payload = structuredClone(detail.payload);
} else {
  const aliceService = createAliceService({
    env,
    keyMaterial: loadRuntimeKeyMaterial(env),
  });
  payload = structuredClone(
    aliceService.prepareMessage({
      plaintext: values.message ?? 'Bob, ini payload uji tamper.',
    }).payload,
  ) as Record<string, unknown>;
}

switch (values.field) {
  case 'ciphertext':
    payload.ciphertextB64 = mutateField(String(payload.ciphertextB64));
    break;
  case 'hash':
    payload.plaintextHashHex = mutateField(String(payload.plaintextHashHex));
    break;
  case 'signature':
    payload.signatureB64 = mutateField(String(payload.signatureB64));
    break;
  case 'encrypted-key':
    payload.encryptedSymmetricKeyB64 = mutateField(
      String(payload.encryptedSymmetricKeyB64),
    );
    break;
}

const response = await fetchJson({
  url: `${targetBaseUrl}/internal/messages/receive`,
  method: 'POST',
  body: payload,
});

const result = sanitizeArtifactDetails({
  targetBaseUrl,
  field: values.field,
  payload,
  response,
}) as Record<string, unknown>;

writeJsonOutput(values.output, result);
printJson(result);
