import { parseArgs } from 'node:util';

import { sanitizeArtifactDetails } from '@ii3230/shared';

import { createAliceService } from '../apps/api/src/modules/alice/service';
import { createBobTransportClient } from '../apps/api/src/modules/alice/transport';
import { loadAliceSendKeyMaterial } from '../apps/api/src/runtime/load-key-material';
import {
  loadScriptEnv,
  printJson,
  resolveTargetBaseUrl,
  tryOpenUrl,
  writeJsonOutput,
} from './support/cli';
import {
  createTestRunId,
  createTestingHeaders,
} from './support/validation-artifacts';

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
    'env-file': {
      type: 'string',
    },
    scenario: {
      type: 'string',
    },
    'test-run-id': {
      type: 'string',
    },
  },
});

if (!values.message) {
  throw new Error('--message is required.');
}

if (!values.target) {
  throw new Error('--target is required.');
}

const main = async () => {
  const env = loadScriptEnv({ envFile: values['env-file'] });
  const keyMaterial = loadAliceSendKeyMaterial(env);
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
  const testRunId = values['test-run-id'] ?? createTestRunId();
  const transportResult = await transportClient.sendPayload(
    targetBaseUrl,
    preparedMessage.payload,
    {
      headers: createTestingHeaders({
        validationMode: 'manual_send',
        testRunId,
        scenario: values.scenario ?? 'manual-send',
      }),
    },
  );

  const detailUrl = `${targetBaseUrl}/messages/${preparedMessage.payload.messageId}`;
  const result = sanitizeArtifactDetails({
    messageId: preparedMessage.payload.messageId,
    targetBaseUrl,
    detailUrl,
    testRunId,
    scenario: values.scenario ?? 'manual-send',
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
};

void main().catch((error) => {
  throw error;
});
