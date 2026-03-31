import { constants, sign, verify } from 'node:crypto';

import { fromBase64, toBase64 } from './base64';

export const signBytes = (input: {
  payload: Buffer;
  privateKeyPem: string;
}): string => {
  return toBase64(
    sign('sha256', input.payload, {
      key: input.privateKeyPem,
      padding: constants.RSA_PKCS1_PSS_PADDING,
      saltLength: constants.RSA_PSS_SALTLEN_DIGEST,
    }),
  );
};

export const verifyBytes = (input: {
  payload: Buffer;
  signatureB64: string;
  publicKeyPem: string;
}): boolean => {
  return verify(
    'sha256',
    input.payload,
    {
      key: input.publicKeyPem,
      padding: constants.RSA_PKCS1_PSS_PADDING,
      saltLength: constants.RSA_PSS_SALTLEN_DIGEST,
    },
    fromBase64(input.signatureB64),
  );
};
