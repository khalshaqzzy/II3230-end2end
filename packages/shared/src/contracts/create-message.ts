import { z } from 'zod';

import { verificationVerdictSchema } from './verdict';

export const messageLifecycleStateSchema = z.enum([
  'prepared',
  'processed',
  'send_failed',
]);
export type MessageLifecycleState = z.infer<typeof messageLifecycleStateSchema>;

export const transportFailureCodeSchema = z.enum([
  'transport_request_failed',
  'transport_http_error',
  'transport_invalid_response',
]);
export type TransportFailureCode = z.infer<typeof transportFailureCodeSchema>;

export const transportFailureSchema = z.object({
  code: transportFailureCodeSchema,
  message: z.string().min(1),
  statusCode: z.number().int().min(100).max(599).nullable(),
});
export type TransportFailure = z.infer<typeof transportFailureSchema>;

export const createMessageRequestSchema = z.object({
  plaintext: z.string().trim().min(1),
  senderIp: z.string().min(1).optional(),
  recipientIp: z.string().min(1).optional(),
});
export type CreateMessageRequest = z.infer<typeof createMessageRequestSchema>;

export const createMessageResponseSchema = z.object({
  messageId: z.string().min(1),
  lifecycleState: messageLifecycleStateSchema,
  verdict: verificationVerdictSchema.nullable(),
  transportFailure: transportFailureSchema.nullable(),
});
export type CreateMessageResponse = z.infer<typeof createMessageResponseSchema>;
