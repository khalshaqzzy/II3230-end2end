import type {
  MessageEvent,
  MessagePayload,
  VerificationVerdict,
} from '@ii3230/shared';

export interface ProcessedMessageRecord {
  payload: MessagePayload;
  plaintext: string | null;
  decryptedPlaintext: string | null;
  verdict: VerificationVerdict;
  events: MessageEvent[];
  processedAt: string;
}
