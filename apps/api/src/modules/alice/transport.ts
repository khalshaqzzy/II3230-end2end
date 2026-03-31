import { z } from 'zod';

import {
  type MessagePayload,
  type TransportFailure,
  verificationVerdictSchema,
} from '@ii3230/shared';
import type { Logger } from 'pino';

const processedResponseSchema = z.object({
  status: z.literal('processed'),
  messageId: z.string().min(1),
  verdict: verificationVerdictSchema,
});

const normalizeBaseUrl = (baseUrl: string) => {
  return baseUrl.replace(/\/+$/, '');
};

export interface BobTransportSuccess {
  ok: true;
  statusCode: number;
  verdict: z.infer<typeof verificationVerdictSchema>;
}

export interface BobTransportFailureResult {
  ok: false;
  transportFailure: TransportFailure;
}

export type BobTransportResult =
  | BobTransportSuccess
  | BobTransportFailureResult;

export interface BobTransportClient {
  sendPayload: (
    baseUrl: string,
    payload: MessagePayload,
    options?: {
      headers?: Record<string, string | undefined>;
    },
  ) => Promise<BobTransportResult>;
}

export const createBobTransportClient = (input: {
  logger: Logger;
}): BobTransportClient => {
  return {
    sendPayload: async (baseUrl, payload, options) => {
      const targetUrl = `${normalizeBaseUrl(baseUrl)}/internal/messages/receive`;
      const headers = {
        'content-type': 'application/json',
        ...Object.fromEntries(
          Object.entries(options?.headers ?? {}).filter(
            ([, value]) => value !== undefined,
          ),
        ),
      };

      try {
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          return {
            ok: false,
            transportFailure: {
              code: 'transport_http_error',
              message: `Bob endpoint returned HTTP ${response.status}.`,
              statusCode: response.status,
            },
          };
        }

        const responseBody = await response.json();
        const parsedResponse = processedResponseSchema.safeParse(responseBody);

        if (!parsedResponse.success) {
          input.logger.warn(
            {
              messageId: payload.messageId,
              targetUrl,
              issues: parsedResponse.error.issues,
            },
            'Bob transport returned an invalid success payload',
          );

          return {
            ok: false,
            transportFailure: {
              code: 'transport_invalid_response',
              message: 'Bob endpoint returned an invalid success payload.',
              statusCode: response.status,
            },
          };
        }

        return {
          ok: true,
          statusCode: response.status,
          verdict: parsedResponse.data.verdict,
        };
      } catch (error) {
        input.logger.warn(
          {
            messageId: payload.messageId,
            targetUrl,
            err: error,
          },
          'Bob transport request failed',
        );

        return {
          ok: false,
          transportFailure: {
            code: 'transport_request_failed',
            message:
              error instanceof Error
                ? error.message
                : 'Unknown transport error.',
            statusCode: null,
          },
        };
      }
    },
  };
};
