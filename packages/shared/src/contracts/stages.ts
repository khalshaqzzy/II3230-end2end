import { z } from 'zod';

export const actorSchema = z.enum(['alice', 'bob', 'system']);
export type Actor = z.infer<typeof actorSchema>;

export const messageStageSchema = z.enum([
  'receive_plaintext',
  'generate_symmetric_key',
  'encrypt_plaintext',
  'encrypt_symmetric_key',
  'generate_hash',
  'generate_signature',
  'send_payload',
  'receive_payload',
  'decrypt_symmetric_key',
  'decrypt_ciphertext',
  'verify_hash',
  'verify_signature',
  'final_verdict',
]);
export type MessageStage = z.infer<typeof messageStageSchema>;

export const messageEventStatusSchema = z.enum([
  'pending',
  'success',
  'failure',
  'rejected',
]);
export type MessageEventStatus = z.infer<typeof messageEventStatusSchema>;
