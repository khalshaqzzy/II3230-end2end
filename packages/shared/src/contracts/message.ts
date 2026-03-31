import { z } from 'zod';

export const symmetricAlgorithmSchema = z.literal('aes-256-gcm');
export type SymmetricAlgorithm = z.infer<typeof symmetricAlgorithmSchema>;

export const asymmetricEncryptionAlgorithmSchema = z.literal('rsa-oaep-sha256');
export type AsymmetricEncryptionAlgorithm = z.infer<
  typeof asymmetricEncryptionAlgorithmSchema
>;

export const signatureAlgorithmSchema = z.literal('rsa-pss-sha256');
export type SignatureAlgorithm = z.infer<typeof signatureAlgorithmSchema>;

export const hashAlgorithmSchema = z.literal('sha-256');
export type HashAlgorithm = z.infer<typeof hashAlgorithmSchema>;

export const signatureInputVersionSchema = z.literal('v1');
export type SignatureInputVersion = z.infer<typeof signatureInputVersionSchema>;

export const algorithmProfileSchema = z.object({
  symmetric: symmetricAlgorithmSchema,
  asymmetricEncryption: asymmetricEncryptionAlgorithmSchema,
  signature: signatureAlgorithmSchema,
  hash: hashAlgorithmSchema,
});
export type AlgorithmProfile = z.infer<typeof algorithmProfileSchema>;

export const encodingMetadataSchema = z.object({
  binaryToText: z.literal('base64'),
  textualPayload: z.literal('utf-8'),
  signatureInput: z.literal('utf-8-json-v1'),
});
export type EncodingMetadata = z.infer<typeof encodingMetadataSchema>;

export const messagePayloadSchema = z.object({
  messageId: z.string().min(1),
  senderId: z.string().min(1),
  recipientId: z.string().min(1),
  sourceIp: z.string().min(1),
  destinationIp: z.string().min(1),
  timestamp: z.string().datetime({ offset: true }),
  algorithms: algorithmProfileSchema,
  ivB64: z.string().min(1),
  authTagB64: z.string().min(1),
  ciphertextB64: z.string().min(1),
  encryptedSymmetricKeyB64: z.string().min(1),
  plaintextHashHex: z.string().regex(/^[a-f0-9]{64}$/),
  signatureB64: z.string().min(1),
  signatureInputVersion: signatureInputVersionSchema,
  encoding: encodingMetadataSchema,
});
export type MessagePayload = z.infer<typeof messagePayloadSchema>;

export const defaultAlgorithmProfile: AlgorithmProfile = {
  symmetric: 'aes-256-gcm',
  asymmetricEncryption: 'rsa-oaep-sha256',
  signature: 'rsa-pss-sha256',
  hash: 'sha-256',
};

export const defaultEncodingMetadata: EncodingMetadata = {
  binaryToText: 'base64',
  textualPayload: 'utf-8',
  signatureInput: 'utf-8-json-v1',
};
