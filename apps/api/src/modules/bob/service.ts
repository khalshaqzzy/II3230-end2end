import {
  type MessageEvent,
  type MessagePayload,
  type VerificationVerdict,
  buildCanonicalSignatureInput,
  decryptCiphertext,
  hashPlaintext,
  sanitizeArtifactDetails,
  unwrapSymmetricKey,
  verifyBytes,
} from '@ii3230/shared';
import type { Logger } from 'pino';

import type { BobReceiveKeyMaterial } from '../../runtime/load-key-material';
import type {
  MessageRepository,
  ProcessedMessageRecord,
} from '../messages/repository';

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
    actor: 'bob',
    stage: input.stage,
    status: input.status,
    summary: input.summary,
    details: sanitizeArtifactDetails(
      input.details ?? {},
    ) as MessageEvent['details'],
    timestamp: nowIso(),
  };
};

const createVerdict = (input: {
  accepted: boolean;
  decryptionSucceeded: boolean;
  integrityValid: boolean;
  signatureValid: boolean;
  failureStage: VerificationVerdict['failureStage'];
  reasonCode: VerificationVerdict['reasonCode'];
  humanSummary: string;
}): VerificationVerdict => {
  return {
    accepted: input.accepted,
    decryptionSucceeded: input.decryptionSucceeded,
    integrityValid: input.integrityValid,
    signatureValid: input.signatureValid,
    failureStage: input.failureStage,
    reasonCode: input.reasonCode,
    humanSummary: input.humanSummary,
  };
};

const finalVerdictEvent = (
  messageId: string,
  verdict: VerificationVerdict,
): MessageEvent => {
  return createEvent({
    messageId,
    stage: 'final_verdict',
    status: verdict.accepted ? 'success' : 'rejected',
    summary: verdict.humanSummary,
    details: {
      accepted: verdict.accepted,
      reasonCode: verdict.reasonCode,
      failureStage: verdict.failureStage,
      decryptionSucceeded: verdict.decryptionSucceeded,
      integrityValid: verdict.integrityValid,
      signatureValid: verdict.signatureValid,
    },
  });
};

const persistProcessedMessage = (
  repository: MessageRepository,
  record: ProcessedMessageRecord,
) => {
  repository.finalizeProcessedMessage(record);
};

export interface BobService {
  processPayload: (payload: MessagePayload) => {
    messageId: string;
    verdict: VerificationVerdict;
  };
}

export const createBobService = (input: {
  keyMaterial: BobReceiveKeyMaterial;
  repository: MessageRepository;
  logger: Logger;
}): BobService => {
  return {
    processPayload: (payload) => {
      const events: MessageEvent[] = [
        createEvent({
          messageId: payload.messageId,
          stage: 'receive_payload',
          status: 'success',
          summary: 'Payload accepted for Bob processing.',
          details: {
            sourceIp: payload.sourceIp,
            destinationIp: payload.destinationIp,
            senderId: payload.senderId,
            recipientId: payload.recipientId,
          },
        }),
      ];

      let decryptedPlaintext: string | null = null;
      let verdict: VerificationVerdict;

      try {
        const symmetricKey = unwrapSymmetricKey(
          payload.encryptedSymmetricKeyB64,
          input.keyMaterial.bobPrivateKeyPem,
        );

        events.push(
          createEvent({
            messageId: payload.messageId,
            stage: 'decrypt_symmetric_key',
            status: 'success',
            summary: 'Encrypted symmetric key decrypted successfully.',
            details: {
              algorithm: payload.algorithms.asymmetricEncryption,
              maskedSymmetricKey: symmetricKey.toString('base64'),
            },
          }),
        );

        try {
          decryptedPlaintext = decryptCiphertext({
            symmetricKey,
            ivB64: payload.ivB64,
            authTagB64: payload.authTagB64,
            ciphertextB64: payload.ciphertextB64,
          });

          events.push(
            createEvent({
              messageId: payload.messageId,
              stage: 'decrypt_ciphertext',
              status: 'success',
              summary: 'Ciphertext decrypted successfully.',
              details: {
                algorithm: payload.algorithms.symmetric,
                plaintextLength: decryptedPlaintext.length,
              },
            }),
          );
        } catch (error) {
          events.push(
            createEvent({
              messageId: payload.messageId,
              stage: 'decrypt_ciphertext',
              status: 'failure',
              summary: 'Ciphertext decryption failed.',
              details: {
                errorMessage:
                  error instanceof Error ? error.message : 'Unknown error',
              },
            }),
          );

          verdict = createVerdict({
            accepted: false,
            decryptionSucceeded: false,
            integrityValid: false,
            signatureValid: false,
            failureStage: 'decrypt_ciphertext',
            reasonCode: 'decryption_failed',
            humanSummary:
              'Payload rejected because ciphertext decryption failed.',
          });

          events.push(finalVerdictEvent(payload.messageId, verdict));

          persistProcessedMessage(input.repository, {
            payload,
            decryptedPlaintext: null,
            verdict,
            events,
            processedAt: nowIso(),
          });

          input.logger.warn(
            { messageId: payload.messageId, verdict },
            'Bob rejected payload during ciphertext decryption',
          );

          return {
            messageId: payload.messageId,
            verdict,
          };
        }

        const computedPlaintextHashHex = hashPlaintext(decryptedPlaintext);
        const integrityValid =
          computedPlaintextHashHex === payload.plaintextHashHex;

        events.push(
          createEvent({
            messageId: payload.messageId,
            stage: 'verify_hash',
            status: integrityValid ? 'success' : 'failure',
            summary: integrityValid
              ? 'Plaintext hash matches transmitted hash.'
              : 'Plaintext hash does not match transmitted hash.',
            details: {
              expectedHashHex: payload.plaintextHashHex,
              computedHashHex: computedPlaintextHashHex,
            },
          }),
        );

        const signaturePayload = buildCanonicalSignatureInput(payload);
        const signatureValid = verifyBytes({
          payload: signaturePayload,
          signatureB64: payload.signatureB64,
          publicKeyPem: input.keyMaterial.alicePublicKeyPem,
        });

        events.push(
          createEvent({
            messageId: payload.messageId,
            stage: 'verify_signature',
            status: signatureValid ? 'success' : 'failure',
            summary: signatureValid
              ? 'Digital signature verified successfully.'
              : 'Digital signature verification failed.',
            details: {
              algorithm: payload.algorithms.signature,
            },
          }),
        );

        if (!integrityValid) {
          verdict = createVerdict({
            accepted: false,
            decryptionSucceeded: true,
            integrityValid: false,
            signatureValid,
            failureStage: 'verify_hash',
            reasonCode: 'integrity_check_failed',
            humanSummary:
              'Payload rejected because decrypted plaintext failed the integrity check.',
          });
        } else if (!signatureValid) {
          verdict = createVerdict({
            accepted: false,
            decryptionSucceeded: true,
            integrityValid: true,
            signatureValid: false,
            failureStage: 'verify_signature',
            reasonCode: 'signature_verification_failed',
            humanSummary:
              'Payload rejected because Alice signature verification failed.',
          });
        } else {
          verdict = createVerdict({
            accepted: true,
            decryptionSucceeded: true,
            integrityValid: true,
            signatureValid: true,
            failureStage: null,
            reasonCode: 'accepted',
            humanSummary:
              'Payload accepted after successful decryption, integrity verification, and signature verification.',
          });
        }
      } catch (error) {
        events.push(
          createEvent({
            messageId: payload.messageId,
            stage: 'decrypt_symmetric_key',
            status: 'failure',
            summary: 'Encrypted symmetric key decryption failed.',
            details: {
              errorMessage:
                error instanceof Error ? error.message : 'Unknown error',
            },
          }),
        );

        verdict = createVerdict({
          accepted: false,
          decryptionSucceeded: false,
          integrityValid: false,
          signatureValid: false,
          failureStage: 'decrypt_symmetric_key',
          reasonCode: 'decryption_failed',
          humanSummary:
            'Payload rejected because Bob could not decrypt the symmetric key.',
        });
      }

      events.push(finalVerdictEvent(payload.messageId, verdict));

      const processedRecord: ProcessedMessageRecord = {
        payload,
        decryptedPlaintext,
        verdict,
        events,
        processedAt: nowIso(),
      };

      persistProcessedMessage(input.repository, processedRecord);

      input.logger.info(
        {
          messageId: payload.messageId,
          accepted: verdict.accepted,
          reasonCode: verdict.reasonCode,
          failureStage: verdict.failureStage,
        },
        'Bob processed payload',
      );

      return {
        messageId: payload.messageId,
        verdict,
      };
    },
  };
};
