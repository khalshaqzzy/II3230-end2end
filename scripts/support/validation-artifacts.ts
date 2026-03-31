import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import type { MessageEvent, VerificationVerdict } from '@ii3230/shared';

import { writeJsonOutput } from './cli';
import { fetchJson } from './http';

export interface MessageDetailArtifact {
  messageId: string;
  plaintext: string | null;
  decryptedPlaintext: string | null;
  verdict: VerificationVerdict | null;
  lifecycleState: string;
  events: MessageEvent[];
}

const timestampSegment = () => {
  return new Date().toISOString().replace(/[:.]/g, '-');
};

export const createArtifactRunDirectory = () => {
  const runDir = path.resolve('artifacts', 'local-tests', timestampSegment());
  fs.mkdirSync(path.join(runDir, 'messages'), { recursive: true });
  fs.mkdirSync(path.join(runDir, 'logs'), { recursive: true });
  return runDir;
};

export const createTestRunId = () => {
  return randomUUID();
};

export const createTestingHeaders = (input: {
  validationMode: string;
  testRunId: string;
  scenario?: string;
}) => {
  return {
    'x-ii3230-validation-mode': input.validationMode,
    'x-ii3230-test-run-id': input.testRunId,
    'x-ii3230-scenario': input.scenario,
  };
};

export const fetchMessageDetail = async (
  targetBaseUrl: string,
  messageId: string,
) => {
  return await fetchJson<MessageDetailArtifact>({
    url: `${targetBaseUrl}/messages/${messageId}`,
  });
};

export const fetchMessageLogs = async (
  targetBaseUrl: string,
  messageId: string,
) => {
  const detail = await fetchMessageDetail(targetBaseUrl, messageId);
  return detail.events;
};

export const writeMessageArtifacts = async (input: {
  runDir: string;
  targetBaseUrl: string;
  messageId: string;
}) => {
  const detail = await fetchMessageDetail(input.targetBaseUrl, input.messageId);
  const logs = detail.events;

  writeJsonOutput(
    path.join(input.runDir, 'messages', `${input.messageId}.json`),
    detail,
  );
  writeJsonOutput(
    path.join(input.runDir, 'logs', `${input.messageId}.json`),
    logs,
  );

  return {
    detail,
    logs,
  };
};

export const assertAcceptedMessage = (input: {
  detail: MessageDetailArtifact;
  plaintext: string;
}) => {
  if (!input.detail.verdict?.accepted) {
    throw new Error('Expected accepted verdict for happy-path validation.');
  }

  if (input.detail.decryptedPlaintext !== input.plaintext) {
    throw new Error('Decrypted plaintext does not match the submitted plaintext.');
  }

  if (input.detail.verdict.failureStage !== null) {
    throw new Error('Happy-path verdict unexpectedly reports a failure stage.');
  }
};

export const assertRejectedVerdict = (input: {
  verdict: VerificationVerdict | null | undefined;
  expectedReasonCode: VerificationVerdict['reasonCode'];
  expectedFailureStage: Exclude<VerificationVerdict['failureStage'], null>;
}) => {
  if (!input.verdict) {
    throw new Error('Expected a rejection verdict but no verdict was returned.');
  }

  if (input.verdict.accepted) {
    throw new Error('Expected a rejected verdict but received an accepted one.');
  }

  if (input.verdict.reasonCode !== input.expectedReasonCode) {
    throw new Error(
      `Expected reasonCode ${input.expectedReasonCode} but received ${input.verdict.reasonCode}.`,
    );
  }

  if (input.verdict.failureStage !== input.expectedFailureStage) {
    throw new Error(
      `Expected failureStage ${input.expectedFailureStage} but received ${input.verdict.failureStage}.`,
    );
  }
};
