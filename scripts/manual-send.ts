import { parseArgs } from 'node:util';

import { sanitizeArtifactDetails } from '@ii3230/shared';

import { createAliceService } from '../apps/api/src/modules/alice/service';
import { createBobTransportClient } from '../apps/api/src/modules/alice/transport';
import { loadRuntimeKeyMaterial } from '../apps/api/src/runtime/load-key-material';
import {
  loadScriptEnv,
  printJson,
  resolveTargetBaseUrl,
  tryOpenUrl,
  writeJsonOutput,
} from './support/cli';

const { values } = parseArgs({
  options: {
    target: {
      type: 'string',
    },
    message: {
      type: 'string',
    },
    'sender-ip': {
      type: 'string',
    },
    'recipient-ip': {
      type: 'string',
    },
    output: {
      type: 'string',
    },
    open: {
      type: 'boolean',
    },
  },
});

if (!values.message) {
  throw new Error('--message is required.');
}

if (!values.target) {
  throw new Error('--target is required.');
}

const env = loadScriptEnv();
const keyMaterial = loadRuntimeKeyMaterial(env);
const aliceService = createAliceService({
  env,
  keyMaterial,
});
const transportClient = createBobTransportClient({
  logger: console as never,
});

const preparedMessage = aliceService.prepareMessage({
  plaintext: values.message,
  senderIp: values['sender-ip'],
  recipientIp: values['recipient-ip'],
});
const targetBaseUrl = resolveTargetBaseUrl(values.target, env);
const transportResult = await transportClient.sendPayload(
  targetBaseUrl,
  preparedMessage.payload,
);

const detailUrl = `${targetBaseUrl}/messages/${preparedMessage.payload.messageId}`;
const result = sanitizeArtifactDetails({
  messageId: preparedMessage.payload.messageId,
  targetBaseUrl,
  detailUrl,
  payload: preparedMessage.payload,
  verdict: transportResult.ok ? transportResult.verdict : null,
  transportFailure: transportResult.ok
    ? null
    : transportResult.transportFailure,
}) as Record<string, unknown>;

writeJsonOutput(values.output, result);
printJson(result);

if (values.open) {
  process.stdout.write(`Detail URL: ${detailUrl}\n`);
  await tryOpenUrl(detailUrl);
}
