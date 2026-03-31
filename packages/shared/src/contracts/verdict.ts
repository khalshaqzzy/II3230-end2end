import { z } from 'zod';

import { messageStageSchema } from './stages';

export const reasonCodeSchema = z.enum([
  'accepted',
  'decryption_failed',
  'integrity_check_failed',
  'signature_verification_failed',
  'invalid_payload',
  'unknown_failure',
]);
export type ReasonCode = z.infer<typeof reasonCodeSchema>;

export const verificationVerdictSchema = z.object({
  accepted: z.boolean(),
  decryptionSucceeded: z.boolean(),
  integrityValid: z.boolean(),
  signatureValid: z.boolean(),
  failureStage: messageStageSchema.nullable(),
  reasonCode: reasonCodeSchema,
  humanSummary: z.string().min(1),
});
export type VerificationVerdict = z.infer<typeof verificationVerdictSchema>;
