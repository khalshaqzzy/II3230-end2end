import { generateKeyPairSync } from 'node:crypto';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { createAliceService } from '../apps/api/src/modules/alice/service';
import { loadAliceSendKeyMaterial } from '../apps/api/src/runtime/load-key-material';
import { fetchJson } from './support/http';
import { loadScriptEnv, printJson, resolveTargetBaseUrl, writeJsonOutput } from './support/cli';
import {
  assertRejectedVerdict,
  createArtifactRunDirectory,
  createTestRunId,
  createTestingHeaders,
  writeMessageArtifacts,
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
    message: {
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
  const env = loadScriptEnv({ envFile: values['env-file'] });
  const targetBaseUrl = resolveTargetBaseUrl(
    values.target ?? env.BOB_TARGET_BASE_URL,
    env,
  );
  const aliceService = createAliceService({
    env,
    keyMaterial: loadAliceSendKeyMaterial(env),
  });
  const runDir = createArtifactRunDirectory();
  const testRunId = createTestRunId();

  const scenarios = [
    {
      name: 'tamper-ciphertext',
      responseFile: 'tamper-ciphertext-response.json',
      preparePayload: () => {
        const payload = structuredClone(
          aliceService.prepareMessage({
            plaintext:
              values.message ?? 'Bob, ini payload uji tamper ciphertext.',
          }).payload,
        );
        payload.ciphertextB64 = mutateBase64Value(payload.ciphertextB64);
        return payload;
      },
      expectedReasonCode: 'decryption_failed' as const,
      expectedFailureStage: 'decrypt_ciphertext' as const,
    },
    {
      name: 'tamper-hash',
      responseFile: 'tamper-hash-response.json',
      preparePayload: () => {
        const payload = structuredClone(
          aliceService.prepareMessage({
            plaintext: values.message ?? 'Bob, ini payload uji tamper hash.',
          }).payload,
        );
        payload.plaintextHashHex = mutateHexValue(payload.plaintextHashHex);
        return payload;
      },
      expectedReasonCode: 'integrity_check_failed' as const,
      expectedFailureStage: 'verify_hash' as const,
    },
    {
      name: 'tamper-signature',
      responseFile: 'tamper-signature-response.json',
      preparePayload: () => {
        const payload = structuredClone(
          aliceService.prepareMessage({
            plaintext:
              values.message ?? 'Bob, ini payload uji tamper signature.',
          }).payload,
        );
        payload.signatureB64 = mutateBase64Value(payload.signatureB64);
        return payload;
      },
      expectedReasonCode: 'signature_verification_failed' as const,
      expectedFailureStage: 'verify_signature' as const,
    },
    {
      name: 'wrong-recipient-key',
      responseFile: 'wrong-recipient-response.json',
      preparePayload: () => {
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
        return aliceService.prepareMessage({
          plaintext:
            values.message ?? 'Bob, ini payload uji wrong recipient key.',
          bobPublicKeyPemOverride: publicKey,
        }).payload;
      },
      expectedReasonCode: 'decryption_failed' as const,
      expectedFailureStage: 'decrypt_symmetric_key' as const,
    },
  ];

  const results = [];

  for (const scenario of scenarios) {
    const payload = scenario.preparePayload();
    const response = await fetchJson<{
      status: string;
      messageId: string;
      verdict: {
        accepted: boolean;
        reasonCode:
          | 'accepted'
          | 'decryption_failed'
          | 'integrity_check_failed'
          | 'signature_verification_failed';
        failureStage:
          | null
          | 'decrypt_symmetric_key'
          | 'decrypt_ciphertext'
          | 'verify_hash'
          | 'verify_signature';
      };
    }>({
      url: `${targetBaseUrl}/internal/messages/receive`,
      method: 'POST',
      body: payload,
      headers: createTestingHeaders({
        validationMode: 'phase4_tamper',
        testRunId,
        scenario: scenario.name,
      }),
    });

    assertRejectedVerdict({
      verdict: response.verdict,
      expectedReasonCode: scenario.expectedReasonCode,
      expectedFailureStage: scenario.expectedFailureStage,
    });

    writeJsonOutput(path.join(runDir, scenario.responseFile), {
      targetBaseUrl,
      testRunId,
      scenario: scenario.name,
      payload,
      response,
    });

    const { detail } = await writeMessageArtifacts({
      runDir,
      targetBaseUrl,
      messageId: payload.messageId,
    });

    results.push({
      scenario: scenario.name,
      status: 'passed',
      messageId: payload.messageId,
      lifecycleState: detail.lifecycleState,
      verdict: detail.verdict,
    });
  }

  const summary = {
    targetBaseUrl,
    artifactDir: runDir,
    testRunId,
    tamperScenarios: results,
  };

  writeJsonOutput(path.join(runDir, 'summary.json'), summary);
  writeJsonOutput(values.output, summary);
  printJson(summary);
};

void main().catch((error) => {
  throw error;
});
