import { constants, privateDecrypt, publicEncrypt } from 'node:crypto';

import { fromBase64, toBase64 } from './base64';

export const wrapSymmetricKey = (
  symmetricKey: Buffer,
  recipientPublicKeyPem: string,
): string => {
  return toBase64(
    publicEncrypt(
      {
        key: recipientPublicKeyPem,
        oaepHash: 'sha256',
        padding: constants.RSA_PKCS1_OAEP_PADDING,
      },
      symmetricKey,
    ),
  );
};

export const unwrapSymmetricKey = (
  encryptedSymmetricKeyB64: string,
  recipientPrivateKeyPem: string,
): Buffer => {
  return privateDecrypt(
    {
      key: recipientPrivateKeyPem,
      oaepHash: 'sha256',
      padding: constants.RSA_PKCS1_OAEP_PADDING,
    },
    fromBase64(encryptedSymmetricKeyB64),
  );
};
