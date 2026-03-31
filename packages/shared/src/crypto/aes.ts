import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { fromBase64, toBase64, utf8ToBuffer } from './base64';

export interface AesGcmEncryptionResult {
  algorithm: 'aes-256-gcm';
  ivB64: string;
  authTagB64: string;
  ciphertextB64: string;
}

export const generateSymmetricKey = (): Buffer => randomBytes(32);

export const encryptPlaintext = (
  plaintext: string,
  symmetricKey: Buffer,
): AesGcmEncryptionResult => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', symmetricKey, iv);
  const ciphertext = Buffer.concat([
    cipher.update(utf8ToBuffer(plaintext)),
    cipher.final(),
  ]);

  return {
    algorithm: 'aes-256-gcm',
    ivB64: toBase64(iv),
    authTagB64: toBase64(cipher.getAuthTag()),
    ciphertextB64: toBase64(ciphertext),
  };
};

export const decryptCiphertext = (input: {
  symmetricKey: Buffer;
  ivB64: string;
  authTagB64: string;
  ciphertextB64: string;
}): string => {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    input.symmetricKey,
    fromBase64(input.ivB64),
  );
  decipher.setAuthTag(fromBase64(input.authTagB64));

  const plaintext = Buffer.concat([
    decipher.update(fromBase64(input.ciphertextB64)),
    decipher.final(),
  ]);

  return plaintext.toString('utf8');
};
