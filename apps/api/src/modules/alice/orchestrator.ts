import type {
  AppEnv,
  CreateMessageRequest,
  CreateMessageResponse,
  MessageEvent,
} from '@ii3230/shared';
import type { Logger } from 'pino';

import type { MessageRepository } from '../messages/repository';
import type { AliceService } from './service';
import type { BobTransportClient } from './transport';

const nowIso = () => new Date().toISOString();

const createSendEvent = (input: {
  messageId: string;
  status: MessageEvent['status'];
  summary: string;
  details?: MessageEvent['details'];
}): MessageEvent => {
  return {
    messageId: input.messageId,
    actor: 'alice',
    stage: 'send_payload',
    status: input.status,
    summary: input.summary,
    details: input.details ?? {},
    timestamp: nowIso(),
  };
};

const resolveBobBaseUrl = (env: AppEnv) => {
  return env.BOB_TARGET_BASE_URL ?? `http://127.0.0.1:${env.PORT}`;
};

export interface MessageCommandService {
  createAndSendMessage: (
    request: CreateMessageRequest,
  ) => Promise<CreateMessageResponse>;
}

export const createMessageCommandService = (input: {
  env: AppEnv;
  aliceService: AliceService;
  bobTransportClient: BobTransportClient;
  repository: MessageRepository;
  logger: Logger;
}): MessageCommandService => {
  return {
    createAndSendMessage: async (request) => {
      const preparedMessage = input.aliceService.prepareMessage({
        plaintext: request.plaintext,
        ...(request.senderIp ? { senderIp: request.senderIp } : {}),
        ...(request.recipientIp ? { recipientIp: request.recipientIp } : {}),
      });

      const targetBaseUrl = resolveBobBaseUrl(input.env);
      const pendingSendEvent = createSendEvent({
        messageId: preparedMessage.payload.messageId,
        status: 'pending',
        summary: 'Alice is sending the payload to Bob.',
        details: {
          targetBaseUrl,
        },
      });

      input.repository.createPreparedMessage({
        payload: preparedMessage.payload,
        plaintext: preparedMessage.plaintext,
        events: [...preparedMessage.events, pendingSendEvent],
      });

      const transportResult = await input.bobTransportClient.sendPayload(
        targetBaseUrl,
        preparedMessage.payload,
      );

      if (!transportResult.ok) {
        const failureEvent = createSendEvent({
          messageId: preparedMessage.payload.messageId,
          status: 'failure',
          summary: 'Alice could not deliver the payload to Bob.',
          details: {
            targetBaseUrl,
            code: transportResult.transportFailure.code,
            statusCode: transportResult.transportFailure.statusCode,
            message: transportResult.transportFailure.message,
          },
        });

        const processedAt = nowIso();
        input.repository.markTransportFailure({
          messageId: preparedMessage.payload.messageId,
          transportFailure: transportResult.transportFailure,
          events: [failureEvent],
          processedAt,
        });

        input.logger.warn(
          {
            messageId: preparedMessage.payload.messageId,
            targetBaseUrl,
            transportFailure: transportResult.transportFailure,
          },
          'Alice send pipeline failed to reach Bob',
        );

        return {
          messageId: preparedMessage.payload.messageId,
          lifecycleState: 'send_failed',
          verdict: null,
          transportFailure: transportResult.transportFailure,
        };
      }

      const successEvent = createSendEvent({
        messageId: preparedMessage.payload.messageId,
        status: 'success',
        summary: 'Alice delivered the payload to Bob.',
        details: {
          targetBaseUrl,
          statusCode: transportResult.statusCode,
        },
      });

      input.repository.appendEvents(preparedMessage.payload.messageId, [
        successEvent,
      ]);

      input.logger.info(
        {
          messageId: preparedMessage.payload.messageId,
          targetBaseUrl,
          accepted: transportResult.verdict.accepted,
          reasonCode: transportResult.verdict.reasonCode,
        },
        'Alice send pipeline completed',
      );

      return {
        messageId: preparedMessage.payload.messageId,
        lifecycleState: 'processed',
        verdict: transportResult.verdict,
        transportFailure: null,
      };
    },
  };
};
