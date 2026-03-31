import path from 'node:path';
import { parseArgs } from 'node:util';

import { createAliceService } from '../apps/api/src/modules/alice/service';
import { loadAliceSendKeyMaterial } from '../apps/api/src/runtime/load-key-material';
import { loadScriptEnv, printJson, resolveTargetBaseUrl, writeJsonOutput } from './support/cli';
import { fetchJson } from './support/http';
import {
  assertAcceptedMessage,
  createArtifactRunDirectory,
  writeMessageArtifacts,
} from './support/phase4';

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
    'env-file': {
      type: 'string',
    },
  },
});

const main = async () => {
  const plaintext =
    values.message ?? 'Bob, ini pesan happy-path LAN untuk validasi Phase 4.';
  const env = loadScriptEnv({ envFile: values['env-file'] });
  const targetBaseUrl = resolveTargetBaseUrl(
    values.target ?? env.BOB_TARGET_BASE_URL,
    env,
  );
  const aliceService = createAliceService({
    env,
    keyMaterial: loadAliceSendKeyMaterial(env),
  });
  const preparedMessage = aliceService.prepareMessage({
    plaintext,
    senderIp: values['sender-ip'],
    recipientIp: values['recipient-ip'],
  });
  const response = await fetchJson<{
    status: string;
    messageId: string;
    verdict: {
      accepted: boolean;
      reasonCode: string;
      failureStage: string | null;
    };
  }>({
    url: `${targetBaseUrl}/internal/messages/receive`,
    method: 'POST',
    body: preparedMessage.payload,
  });

  const runDir = createArtifactRunDirectory();
  writeJsonOutput(
    path.join(runDir, 'happy-path-response.json'),
    {
      targetBaseUrl,
      payload: preparedMessage.payload,
      response,
    },
  );

  const { detail } = await writeMessageArtifacts({
    runDir,
    targetBaseUrl,
    messageId: preparedMessage.payload.messageId,
  });

  assertAcceptedMessage({
    detail,
    plaintext,
  });

  const summary = {
    targetBaseUrl,
    artifactDir: runDir,
    happyPath: {
      status: 'passed',
      messageId: preparedMessage.payload.messageId,
      lifecycleState: detail.lifecycleState,
      verdict: detail.verdict,
    },
  };

  writeJsonOutput(path.join(runDir, 'summary.json'), summary);
  writeJsonOutput(values.output, summary);
  printJson(summary);
};

void main().catch((error) => {
  throw error;
});
