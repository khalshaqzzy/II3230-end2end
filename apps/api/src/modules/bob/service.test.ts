import { hashPlaintext } from '@ii3230/shared';

import { createLogger } from '../../logger';
import { createTestHarness } from '../../test-support/fixtures';
import { createBobService } from './service';

const createRepositorySpy = () => {
  const processedRecords: unknown[] = [];

  return {
    repository: {
      createPreparedMessage: () => {},
      appendEvents: () => {},
      markTransportFailure: () => {},
      finalizeProcessedMessage: (input: unknown) => {
        processedRecords.push(input);
      },
      listMessages: () => [],
      findMessageDetail: () => null,
    },
    processedRecords,
  };
};

describe('Bob verification service', () => {
  it('accepts the happy path payload', () => {
    const harness = createTestHarness();
    const repositorySpy = createRepositorySpy();
    const bobService = createBobService({
      keyMaterial: {
        alicePublicKeyPem: harness.keys.alice.publicKeyPem,
        bobPrivateKeyPem: harness.keys.bob.privateKeyPem,
      },
      repository: repositorySpy.repository,
      logger: createLogger(harness.env),
    });
    const { payload } = harness.createPayload();

    try {
      const result = bobService.processPayload(payload);

      expect(result.verdict.accepted).toBe(true);
      expect(result.verdict.reasonCode).toBe('accepted');
      expect(repositorySpy.processedRecords).toHaveLength(1);
    } finally {
      harness.cleanup();
    }
  });

  it('rejects when the symmetric key is encrypted for the wrong Bob key', () => {
    const harness = createTestHarness();
    const repositorySpy = createRepositorySpy();
    const bobService = createBobService({
      keyMaterial: {
        alicePublicKeyPem: harness.keys.alice.publicKeyPem,
        bobPrivateKeyPem: harness.keys.bob.privateKeyPem,
      },
      repository: repositorySpy.repository,
      logger: createLogger(harness.env),
    });
    const { payload } = harness.createPayload({
      encryptedKeyPublicKeyPem: harness.keys.alternateBob.publicKeyPem,
    });

    try {
      const result = bobService.processPayload(payload);

      expect(result.verdict.accepted).toBe(false);
      expect(result.verdict.reasonCode).toBe('decryption_failed');
      expect(result.verdict.failureStage).toBe('decrypt_symmetric_key');
    } finally {
      harness.cleanup();
    }
  });

  it('rejects tampered ciphertext at the ciphertext decryption stage', () => {
    const harness = createTestHarness();
    const repositorySpy = createRepositorySpy();
    const bobService = createBobService({
      keyMaterial: {
        alicePublicKeyPem: harness.keys.alice.publicKeyPem,
        bobPrivateKeyPem: harness.keys.bob.privateKeyPem,
      },
      repository: repositorySpy.repository,
      logger: createLogger(harness.env),
    });
    const { payload } = harness.createPayload();

    const midpoint = Math.floor(payload.ciphertextB64.length / 2);
    payload.ciphertextB64 = `${payload.ciphertextB64.slice(0, midpoint)}A${payload.ciphertextB64.slice(midpoint + 1)}`;

    try {
      const result = bobService.processPayload(payload);

      expect(result.verdict.accepted).toBe(false);
      expect(result.verdict.reasonCode).toBe('decryption_failed');
      expect(result.verdict.failureStage).toBe('decrypt_ciphertext');
    } finally {
      harness.cleanup();
    }
  });

  it('keeps integrity failure precedence even when signature also becomes invalid', () => {
    const harness = createTestHarness();
    const repositorySpy = createRepositorySpy();
    const bobService = createBobService({
      keyMaterial: {
        alicePublicKeyPem: harness.keys.alice.publicKeyPem,
        bobPrivateKeyPem: harness.keys.bob.privateKeyPem,
      },
      repository: repositorySpy.repository,
      logger: createLogger(harness.env),
    });
    const { payload } = harness.createPayload();

    payload.plaintextHashHex = hashPlaintext('plaintext yang berbeda');

    try {
      const result = bobService.processPayload(payload);

      expect(result.verdict.accepted).toBe(false);
      expect(result.verdict.reasonCode).toBe('integrity_check_failed');
      expect(result.verdict.failureStage).toBe('verify_hash');
      expect(result.verdict.signatureValid).toBe(false);
    } finally {
      harness.cleanup();
    }
  });

  it('rejects tampered signatures after a valid decrypt and hash verification', () => {
    const harness = createTestHarness();
    const repositorySpy = createRepositorySpy();
    const bobService = createBobService({
      keyMaterial: {
        alicePublicKeyPem: harness.keys.alice.publicKeyPem,
        bobPrivateKeyPem: harness.keys.bob.privateKeyPem,
      },
      repository: repositorySpy.repository,
      logger: createLogger(harness.env),
    });
    const { payload } = harness.createPayload();

    payload.signatureB64 = `A${payload.signatureB64.slice(1)}`;

    try {
      const result = bobService.processPayload(payload);

      expect(result.verdict.accepted).toBe(false);
      expect(result.verdict.reasonCode).toBe('signature_verification_failed');
      expect(result.verdict.failureStage).toBe('verify_signature');
      expect(result.verdict.integrityValid).toBe(true);
    } finally {
      harness.cleanup();
    }
  });
});
