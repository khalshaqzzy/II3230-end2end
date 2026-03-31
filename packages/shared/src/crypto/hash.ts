import { createHash } from 'node:crypto';

export const hashPlaintext = (plaintext: string): string => {
  return createHash('sha256').update(plaintext, 'utf8').digest('hex');
};
