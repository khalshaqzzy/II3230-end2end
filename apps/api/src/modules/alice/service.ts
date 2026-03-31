import { randomUUID } from 'node:crypto';

import {
  type AppEnv,
  type MessageEvent,
  type MessagePayload,
  SIGNATURE_INPUT_VERSION,
  buildCanonicalSignatureInput,
  defaultAlgorithmProfile,
  defaultEncodingMetadata,
  encryptPlaintext,
  generateSymmetricKey,
  hashPlaintext,
  maskEducationalSecret,
  signBytes,
  wrapSymmetricKey,
} from '@ii3230/shared';

import type { RuntimeKeyMaterial } from '../../runtime/load-key-material';

const nowIso = () => new Date().toISOString();

const createEvent = (input: {
  messageId: string;
  stage: MessageEvent['stage'];
  status: MessageEvent['status'];
  summary: string;
  details?: MessageEvent['details'];
}): MessageEvent => {
  return {
    messageId: input.messageId,
    actor: 'alice',
    stage: input.stage,
    status: input.status,
    summary: input.summary,
    details: input.details ?? {},
    timestamp: nowIso(),
  };
};

export interface PreparedMessage {
  payload: MessagePayload;
  plaintext: string;
  events: MessageEvent[];
}

export interface AliceService {
  prepareMessage: (input: {
    plaintext: string;
    senderIp?: string;
    recipientIp?: string;
  }) => PreparedMessage;
}

export const createAliceService = (input: {
  env: AppEnv;
  keyMaterial: RuntimeKeyMaterial;
}): AliceService => {
  return {
    prepareMessage: ({ plaintext, senderIp, recipientIp }) => {
      const messageId = randomUUID();
      const createdAt = nowIso();
      const symmetricKey = generateSymmetricKey();
      const encryptedPayload = encryptPlaintext(plaintext, symmetricKey);
      const plaintextHashHex = hashPlaintext(plaintext);

      const payloadWithoutSignature = {
        messageId,
        senderId: 'alice',
        recipientId: 'bob',
        sourceIp: senderIp ?? input.env.ALICE_LOGICAL_IP,
        destinationIp: recipientIp ?? input.env.BOB_LOGICAL_IP,
        timestamp: createdAt,
        algorithms: defaultAlgorithmProfile,
        ivB64: encryptedPayload.ivB64,
        authTagB64: encryptedPayload.authTagB64,
        ciphertextB64: encryptedPayload.ciphertextB64,
        encryptedSymmetricKeyB64: wrapSymmetricKey(
          symmetricKey,
          input.keyMaterial.bobPublicKeyPem,
        ),
        plaintextHashHex,
        signatureInputVersion: SIGNATURE_INPUT_VERSION,
        signatureB64: '',
        encoding: defaultEncodingMetadata,
      } satisfies MessagePayload;

      const signatureB64 = signBytes({
        payload: buildCanonicalSignatureInput(payloadWithoutSignature),
        privateKeyPem: input.keyMaterial.alicePrivateKeyPem,
      });

      const payload = {
        ...payloadWithoutSignature,
        signatureB64,
      };

      return {
        payload,
        plaintext,
        events: [
          createEvent({
            messageId,
            stage: 'receive_plaintext',
            status: 'success',
            summary: 'Alice accepted plaintext for secure delivery.',
            details: {
              plaintextLength: plaintext.length,
              senderIp: payload.sourceIp,
              recipientIp: payload.destinationIp,
            },
          }),
          createEvent({
            messageId,
            stage: 'generate_symmetric_key',
            status: 'success',
            summary: 'Alice generated a fresh symmetric key.',
            details: {
              algorithm: payload.algorithms.symmetric,
              maskedSymmetricKey: maskEducationalSecret(
                symmetricKey.toString('base64'),
              ),
            },
          }),
          createEvent({
            messageId,
            stage: 'encrypt_plaintext',
            status: 'success',
            summary: 'Alice encrypted the plaintext with AES-256-GCM.',
            details: {
              algorithm: payload.algorithms.symmetric,
              ivB64: payload.ivB64,
              authTagB64: payload.authTagB64,
              ciphertextLength: payload.ciphertextB64.length,
            },
          }),
          createEvent({
            messageId,
            stage: 'encrypt_symmetric_key',
            status: 'success',
            summary: 'Alice encrypted the symmetric key for Bob.',
            details: {
              algorithm: payload.algorithms.asymmetricEncryption,
              encryptedSymmetricKeyLength:
                payload.encryptedSymmetricKeyB64.length,
            },
          }),
          createEvent({
            messageId,
            stage: 'generate_hash',
            status: 'success',
            summary: 'Alice generated the plaintext integrity hash.',
            details: {
              algorithm: payload.algorithms.hash,
              plaintextHashHex: payload.plaintextHashHex,
            },
          }),
          createEvent({
            messageId,
            stage: 'generate_signature',
            status: 'success',
            summary: 'Alice signed the canonical message envelope.',
            details: {
              algorithm: payload.algorithms.signature,
              signatureInputVersion: payload.signatureInputVersion,
              signatureLength: payload.signatureB64.length,
            },
          }),
        ],
      };
    },
  };
};
