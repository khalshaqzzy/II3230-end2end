import { generateKeyPairSync } from 'node:crypto';

import {
  SIGNATURE_INPUT_VERSION,
  buildCanonicalSignatureInput,
  decryptCiphertext,
  defaultAlgorithmProfile,
  defaultEncodingMetadata,
  encryptPlaintext,
  generateSymmetricKey,
  hashPlaintext,
  maskEducationalSecret,
  sanitizeArtifactDetails,
  signBytes,
  unwrapSymmetricKey,
  verifyBytes,
  wrapSymmetricKey,
} from './index';

describe('shared crypto helpers', () => {
  it('encrypts and decrypts plaintext with AES-256-GCM', () => {
    const symmetricKey = generateSymmetricKey();
    const encrypted = encryptPlaintext(
      'Bob, ini pesan uji lokal.',
      symmetricKey,
    );

    const decrypted = decryptCiphertext({
      symmetricKey,
      ivB64: encrypted.ivB64,
      authTagB64: encrypted.authTagB64,
      ciphertextB64: encrypted.ciphertextB64,
    });

    expect(decrypted).toBe('Bob, ini pesan uji lokal.');
  });

  it('wraps and unwraps the symmetric key with RSA-OAEP SHA-256', () => {
    const symmetricKey = generateSymmetricKey();
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    const wrapped = wrapSymmetricKey(symmetricKey, publicKey);
    const unwrapped = unwrapSymmetricKey(wrapped, privateKey);

    expect(unwrapped.equals(symmetricKey)).toBe(true);
  });

  it('hashes plaintext with SHA-256 deterministically', () => {
    expect(hashPlaintext('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('builds a deterministic canonical signature input and verifies signatures', () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    const payload = {
      messageId: 'msg-001',
      senderId: 'alice',
      recipientId: 'bob',
      sourceIp: '10.10.0.2',
      destinationIp: '10.10.0.3',
      timestamp: '2026-03-31T12:00:00.000Z',
      algorithms: defaultAlgorithmProfile,
      ivB64: 'iv',
      authTagB64: 'tag',
      ciphertextB64: 'cipher',
      encryptedSymmetricKeyB64: 'wrapped',
      plaintextHashHex: hashPlaintext('Bob, ini pesan uji lokal.'),
      signatureInputVersion: SIGNATURE_INPUT_VERSION,
      signatureB64: 'pending',
      encoding: defaultEncodingMetadata,
    };

    const canonicalA = buildCanonicalSignatureInput(payload);
    const canonicalB = buildCanonicalSignatureInput(payload);
    const signatureB64 = signBytes({
      payload: canonicalA,
      privateKeyPem: privateKey,
    });

    expect(canonicalA.equals(canonicalB)).toBe(true);
    expect(
      verifyBytes({
        payload: canonicalA,
        signatureB64,
        publicKeyPem: publicKey,
      }),
    ).toBe(true);

    const mutatedCiphertext = buildCanonicalSignatureInput({
      ...payload,
      ciphertextB64: 'cipher-mutated',
    });
    const mutatedHash = buildCanonicalSignatureInput({
      ...payload,
      plaintextHashHex: hashPlaintext('mutated'),
    });
    const mutatedMetadata = buildCanonicalSignatureInput({
      ...payload,
      sourceIp: '10.10.0.99',
    });

    expect(
      verifyBytes({
        payload: mutatedCiphertext,
        signatureB64,
        publicKeyPem: publicKey,
      }),
    ).toBe(false);
    expect(
      verifyBytes({
        payload: mutatedHash,
        signatureB64,
        publicKeyPem: publicKey,
      }),
    ).toBe(false);
    expect(
      verifyBytes({
        payload: mutatedMetadata,
        signatureB64,
        publicKeyPem: publicKey,
      }),
    ).toBe(false);
  });

  it('masks educational secrets without exposing the full value', () => {
    const masked = maskEducationalSecret('abcdefghijklmnopqrstuvwxyz');

    expect(masked).not.toContain('ghijklmnop');
    expect(masked.startsWith('abcdef')).toBe(true);
    expect(masked.endsWith('wxyz')).toBe(true);
  });

  it('sanitizes private keys and raw symmetric keys from artifacts', () => {
    const sanitized = sanitizeArtifactDetails({
      privateKeyPath: '.local/keys/alice/private.pem',
      privateKeyPem:
        '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----',
      symmetricKey: 'abcdefghijklmnopqrstuvwxyz',
      nested: {
        raw_key: '1234567890abcdef',
      },
    });

    expect(sanitized).toEqual({
      privateKeyPath: '[REDACTED_PRIVATE_KEY]',
      privateKeyPem: '[REDACTED_PRIVATE_KEY]',
      symmetricKey: 'abcdef****************wxyz',
      nested: {
        raw_key: '123456******cdef',
      },
    });
  });
});
