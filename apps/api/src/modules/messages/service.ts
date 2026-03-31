import type {
  MessageEvent,
  MessagePayload,
  VerificationVerdict,
} from '@ii3230/shared';
import { sanitizeArtifactDetails } from '@ii3230/shared';

import type { BobRepository } from '../bob/repository';

const sanitizeValue = <T>(value: T): T => {
  return sanitizeArtifactDetails(value) as T;
};

export interface MessageListResponse {
  messages: {
    messageId: string;
    senderId: string;
    recipientId: string;
    createdAt: string;
    processedAt: string;
    accepted: boolean;
    reasonCode: VerificationVerdict['reasonCode'];
    failureStage: VerificationVerdict['failureStage'];
  }[];
}

export interface MessageDetailResponse {
  messageId: string;
  createdAt: string;
  processedAt: string;
  payload: MessagePayload;
  plaintext: string | null;
  decryptedPlaintext: string | null;
  verdict: VerificationVerdict;
  events: MessageEvent[];
}

export interface MessageQueryService {
  listMessages: () => MessageListResponse;
  getMessageDetail: (messageId: string) => MessageDetailResponse | null;
}

export const createMessageQueryService = (input: {
  repository: BobRepository;
}): MessageQueryService => {
  return {
    listMessages: () => {
      return {
        messages: input.repository.listMessages().map((message) => ({
          messageId: message.messageId,
          senderId: message.senderId,
          recipientId: message.recipientId,
          createdAt: message.createdAt,
          processedAt: message.processedAt,
          accepted: message.accepted,
          reasonCode: message.reasonCode,
          failureStage: message.failureStage,
        })),
      };
    },
    getMessageDetail: (messageId) => {
      const detail = input.repository.findMessageDetail(messageId);

      if (!detail) {
        return null;
      }

      return {
        messageId: detail.payload.messageId,
        createdAt: detail.createdAt,
        processedAt: detail.processedAt,
        payload: sanitizeValue(detail.payload),
        plaintext: detail.plaintext,
        decryptedPlaintext: detail.decryptedPlaintext,
        verdict: sanitizeValue(detail.verdict),
        events: sanitizeValue(detail.events),
      };
    },
  };
};
