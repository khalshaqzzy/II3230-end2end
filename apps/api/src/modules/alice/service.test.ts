import { buildCanonicalSignatureInput, verifyBytes } from '@ii3230/shared';

import { createTestHarness } from '../../test-support/fixtures';
import { createAliceService } from './service';

describe('Alice service', () => {
  it('builds a valid payload and canonical signature', () => {
    const harness = createTestHarness();
    const aliceService = createAliceService({
      env: harness.env,
      keyMaterial: harness.runtime.keyMaterial,
    });

    try {
      const prepared = aliceService.prepareMessage({
        plaintext: 'Bob, ini pesan Alice yang valid.',
      });

      expect(prepared.payload.senderId).toBe('alice');
      expect(prepared.payload.recipientId).toBe('bob');
      expect(prepared.events).toHaveLength(6);
      expect(
        verifyBytes({
          payload: buildCanonicalSignatureInput(prepared.payload),
          signatureB64: prepared.payload.signatureB64,
          publicKeyPem: harness.keys.alice.publicKeyPem,
        }),
      ).toBe(true);
    } finally {
      harness.cleanup();
    }
  });

  it('applies sender and recipient IP overrides', () => {
    const harness = createTestHarness();
    const aliceService = createAliceService({
      env: harness.env,
      keyMaterial: harness.runtime.keyMaterial,
    });

    try {
      const prepared = aliceService.prepareMessage({
        plaintext: 'Bob, gunakan IP override ini.',
        senderIp: '192.168.1.10',
        recipientIp: '192.168.1.20',
      });

      expect(prepared.payload.sourceIp).toBe('192.168.1.10');
      expect(prepared.payload.destinationIp).toBe('192.168.1.20');
    } finally {
      harness.cleanup();
    }
  });

  it('generates unique message ids and ciphertext artifacts per send', () => {
    const harness = createTestHarness();
    const aliceService = createAliceService({
      env: harness.env,
      keyMaterial: harness.runtime.keyMaterial,
    });

    try {
      const first = aliceService.prepareMessage({
        plaintext: 'Bob, pengiriman pertama.',
      });
      const second = aliceService.prepareMessage({
        plaintext: 'Bob, pengiriman pertama.',
      });

      expect(first.payload.messageId).not.toBe(second.payload.messageId);
      expect(first.payload.ivB64).not.toBe(second.payload.ivB64);
      expect(first.payload.ciphertextB64).not.toBe(
        second.payload.ciphertextB64,
      );
    } finally {
      harness.cleanup();
    }
  });
});
