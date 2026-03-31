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
import type { BobRequestContext } from './request-context';

const nowIso = () => new Date().toISOString();

const buildTestingContextDetails = (context?: BobRequestContext) => {
  return {
    validationMode: context?.validationMode ?? null,
    testRunId: context?.testRunId ?? null,
    scenario: context?.scenario ?? null,
  };
};

const buildRequestContextDetails = (context?: BobRequestContext) => {
  return {
    actualRequesterIp: context?.actualRequesterIp ?? null,
    remoteAddress: context?.remoteAddress ?? null,
    forwardedFor: context?.forwardedFor ?? null,
    userAgent: context?.userAgent ?? null,
  };
};

const createBobEvent = (input: {
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

const createInferredAliceEvent = (input: {
  payload: MessagePayload;
  stage: MessageEvent['stage'];
  status: MessageEvent['status'];
  summary: string;
  timestamp: string;
  details?: MessageEvent['details'];
}): MessageEvent => {
  return {
    messageId: input.payload.messageId,
    actor: 'alice',
    stage: input.stage,
    status: input.status,
    summary: input.summary,
    details: sanitizeArtifactDetails(
      input.details ?? {},
    ) as MessageEvent['details'],
    timestamp: input.timestamp,
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

const createInferredAliceTimeline = (input: {
  payload: MessagePayload;
  decryptedPlaintext: string | null;
  context?: BobRequestContext;
}) => {
  const timestampBase = new Date(input.payload.timestamp).getTime();
  const sharedDetails = {
    ...buildTestingContextDetails(input.context),
    transportPath: 'direct_bob_receive',
  };
  const nextTimestamp = (offsetMs: number) =>
    new Date(timestampBase + offsetMs).toISOString();

  return [
    createInferredAliceEvent({
      payload: input.payload,
      stage: 'receive_plaintext',
      status: 'success',
      summary: 'Alice plaintext submission was inferred from the received payload.',
      timestamp: nextTimestamp(0),
      details: {
        ...sharedDetails,
        plaintextLength: input.decryptedPlaintext?.length ?? null,
        senderIp: input.payload.sourceIp,
        recipientIp: input.payload.destinationIp,
      },
    }),
    createInferredAliceEvent({
      payload: input.payload,
      stage: 'generate_symmetric_key',
      status: 'success',
      summary: 'Alice symmetric-key generation was inferred from the received payload.',
      timestamp: nextTimestamp(1),
      details: {
        ...sharedDetails,
        algorithm: input.payload.algorithms.symmetric,
      },
    }),
    createInferredAliceEvent({
      payload: input.payload,
      stage: 'encrypt_plaintext',
      status: 'success',
      summary: 'Alice plaintext encryption was inferred from the received payload.',
      timestamp: nextTimestamp(2),
      details: {
        ...sharedDetails,
        algorithm: input.payload.algorithms.symmetric,
        ivB64: input.payload.ivB64,
        authTagB64: input.payload.authTagB64,
        ciphertextLength: input.payload.ciphertextB64.length,
      },
    }),
    createInferredAliceEvent({
      payload: input.payload,
      stage: 'encrypt_symmetric_key',
      status: 'success',
      summary:
        'Alice symmetric-key wrapping was inferred from the received payload.',
      timestamp: nextTimestamp(3),
      details: {
        ...sharedDetails,
        algorithm: input.payload.algorithms.asymmetricEncryption,
        encryptedSymmetricKeyLength:
          input.payload.encryptedSymmetricKeyB64.length,
      },
    }),
    createInferredAliceEvent({
      payload: input.payload,
      stage: 'generate_hash',
      status: 'success',
      summary: 'Alice hash generation was inferred from the received payload.',
      timestamp: nextTimestamp(4),
      details: {
        ...sharedDetails,
        algorithm: input.payload.algorithms.hash,
        plaintextHashHex: input.payload.plaintextHashHex,
      },
    }),
    createInferredAliceEvent({
      payload: input.payload,
      stage: 'generate_signature',
      status: 'success',
      summary:
        'Alice signature generation was inferred from the received payload.',
      timestamp: nextTimestamp(5),
      details: {
        ...sharedDetails,
        algorithm: input.payload.algorithms.signature,
        signatureInputVersion: input.payload.signatureInputVersion,
        signatureLength: input.payload.signatureB64.length,
      },
    }),
    createInferredAliceEvent({
      payload: input.payload,
      stage: 'send_payload',
      status: 'success',
      summary: 'Alice payload delivery was inferred from Bob receiving the payload.',
      timestamp: nextTimestamp(6),
      details: {
        ...sharedDetails,
        sourceIp: input.payload.sourceIp,
        destinationIp: input.payload.destinationIp,
      },
    }),
  ];
};

const finalVerdictEvent = (
  messageId: string,
  verdict: VerificationVerdict,
  context?: BobRequestContext,
): MessageEvent => {
  return createBobEvent({
    messageId,
    stage: 'final_verdict',
    status: verdict.accepted ? 'success' : 'rejected',
    summary: verdict.humanSummary,
    details: {
      ...buildTestingContextDetails(context),
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
  processPayload: (
    payload: MessagePayload,
    context?: BobRequestContext,
  ) => {
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
    processPayload: (payload, context) => {
      const existingMessage =
        input.repository.findMessageDetail(payload.messageId);
      const contextDetails = {
        ...buildRequestContextDetails(context),
        ...buildTestingContextDetails(context),
      };

      const events: MessageEvent[] = [
        createBobEvent({
          messageId: payload.messageId,
          stage: 'receive_payload',
          status: 'success',
          summary: 'Payload accepted for Bob processing.',
          details: {
            ...contextDetails,
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
          createBobEvent({
            messageId: payload.messageId,
            stage: 'decrypt_symmetric_key',
            status: 'success',
            summary: 'Encrypted symmetric key decrypted successfully.',
            details: {
              ...contextDetails,
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
            createBobEvent({
              messageId: payload.messageId,
              stage: 'decrypt_ciphertext',
              status: 'success',
              summary: 'Ciphertext decrypted successfully.',
              details: {
                ...contextDetails,
                algorithm: payload.algorithms.symmetric,
                plaintextLength: decryptedPlaintext.length,
              },
            }),
          );
        } catch (error) {
          events.push(
            createBobEvent({
              messageId: payload.messageId,
              stage: 'decrypt_ciphertext',
              status: 'failure',
              summary: 'Ciphertext decryption failed.',
              details: {
                ...contextDetails,
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

          if (!existingMessage) {
            events.unshift(
              ...createInferredAliceTimeline({
                payload,
                decryptedPlaintext: null,
                ...(context ? { context } : {}),
              }),
            );
          }

          events.push(finalVerdictEvent(payload.messageId, verdict, context));

          persistProcessedMessage(input.repository, {
            payload,
            ...(existingMessage ? {} : { plaintext: null }),
            decryptedPlaintext: null,
            verdict,
            events,
            processedAt: nowIso(),
          });

          input.logger.warn(
            { messageId: payload.messageId, verdict, context: contextDetails },
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
          createBobEvent({
            messageId: payload.messageId,
            stage: 'verify_hash',
            status: integrityValid ? 'success' : 'failure',
            summary: integrityValid
              ? 'Plaintext hash matches transmitted hash.'
              : 'Plaintext hash does not match transmitted hash.',
            details: {
              ...contextDetails,
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
          createBobEvent({
            messageId: payload.messageId,
            stage: 'verify_signature',
            status: signatureValid ? 'success' : 'failure',
            summary: signatureValid
              ? 'Digital signature verified successfully.'
              : 'Digital signature verification failed.',
            details: {
              ...contextDetails,
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
          createBobEvent({
            messageId: payload.messageId,
            stage: 'decrypt_symmetric_key',
            status: 'failure',
            summary: 'Encrypted symmetric key decryption failed.',
            details: {
              ...contextDetails,
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

      if (!existingMessage) {
        events.unshift(
          ...createInferredAliceTimeline({
            payload,
            decryptedPlaintext,
            ...(context ? { context } : {}),
          }),
        );
      }

      events.push(finalVerdictEvent(payload.messageId, verdict, context));

      const processedRecord: ProcessedMessageRecord = {
        payload,
        ...(existingMessage ? {} : { plaintext: decryptedPlaintext }),
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
          context: contextDetails,
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
