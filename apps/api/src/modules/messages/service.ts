import type {
  MessageEvent,
  MessageLifecycleState,
  MessagePayload,
  TransportFailure,
  VerificationVerdict,
} from '@ii3230/shared';
import { sanitizeArtifactDetails } from '@ii3230/shared';

import type { MessageRepository } from './repository';

const sanitizeValue = <T>(value: T): T => {
  return sanitizeArtifactDetails(value) as T;
};

export interface MessageListResponse {
  messages: {
    messageId: string;
    senderId: string;
    recipientId: string;
    createdAt: string;
    processedAt: string | null;
    lifecycleState: MessageLifecycleState;
    verdict: VerificationVerdict | null;
  }[];
}

export interface MessageDetailResponse {
  messageId: string;
  createdAt: string;
  processedAt: string | null;
  lifecycleState: MessageLifecycleState;
  payload: MessagePayload;
  plaintext: string | null;
  decryptedPlaintext: string | null;
  verdict: VerificationVerdict | null;
  transportFailure: TransportFailure | null;
  events: MessageEvent[];
}

export interface MessageQueryService {
  listMessages: () => MessageListResponse;
  getMessageDetail: (messageId: string) => MessageDetailResponse | null;
}

export const createMessageQueryService = (input: {
  repository: MessageRepository;
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
          lifecycleState: message.lifecycleState,
          verdict: sanitizeValue(message.verdict),
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
        lifecycleState: detail.lifecycleState,
        payload: sanitizeValue(detail.payload),
        plaintext: detail.plaintext,
        decryptedPlaintext: detail.decryptedPlaintext,
        verdict: sanitizeValue(detail.verdict),
        transportFailure: sanitizeValue(detail.transportFailure),
        events: sanitizeValue(detail.events),
      };
    },
  };
};
