import { asc, desc, eq, sql } from 'drizzle-orm';

import type {
  MessageEvent,
  MessageLifecycleState,
  MessagePayload,
  TransportFailure,
  VerificationVerdict,
} from '@ii3230/shared';

import type { DatabaseClient } from '../../db/client';
import {
  type MessageEventRow,
  type MessageRow,
  messageEventsTable,
  messagesTable,
} from '../../db/schema';

const serializeDetails = (details: MessageEvent['details']): string => {
  return JSON.stringify(details);
};

const deserializeDetails = (value: string): MessageEvent['details'] => {
  return JSON.parse(value) as MessageEvent['details'];
};

const toPayloadColumns = (payload: MessagePayload) => {
  return {
    senderId: payload.senderId,
    recipientId: payload.recipientId,
    sourceIp: payload.sourceIp,
    destinationIp: payload.destinationIp,
    timestamp: payload.timestamp,
    symmetricAlgorithm: payload.algorithms.symmetric,
    asymmetricEncryptionAlgorithm: payload.algorithms.asymmetricEncryption,
    signatureAlgorithm: payload.algorithms.signature,
    hashAlgorithm: payload.algorithms.hash,
    ivB64: payload.ivB64,
    authTagB64: payload.authTagB64,
    ciphertextB64: payload.ciphertextB64,
    encryptedSymmetricKeyB64: payload.encryptedSymmetricKeyB64,
    plaintextHashHex: payload.plaintextHashHex,
    signatureB64: payload.signatureB64,
    signatureInputVersion: payload.signatureInputVersion,
    encodingBinaryToText: payload.encoding.binaryToText,
    encodingTextualPayload: payload.encoding.textualPayload,
    encodingSignatureInput: payload.encoding.signatureInput,
  };
};

const toEventInsert = (event: MessageEvent) => {
  return {
    messageId: event.messageId,
    actor: event.actor,
    stage: event.stage,
    status: event.status,
    summary: event.summary,
    detailsJson: serializeDetails(event.details),
    createdAt: event.timestamp,
  };
};

const mapRowToPayload = (row: MessageRow): MessagePayload => {
  return {
    messageId: row.id,
    senderId: row.senderId,
    recipientId: row.recipientId,
    sourceIp: row.sourceIp,
    destinationIp: row.destinationIp,
    timestamp: row.timestamp,
    algorithms: {
      symmetric:
        row.symmetricAlgorithm as MessagePayload['algorithms']['symmetric'],
      asymmetricEncryption:
        row.asymmetricEncryptionAlgorithm as MessagePayload['algorithms']['asymmetricEncryption'],
      signature:
        row.signatureAlgorithm as MessagePayload['algorithms']['signature'],
      hash: row.hashAlgorithm as MessagePayload['algorithms']['hash'],
    },
    ivB64: row.ivB64,
    authTagB64: row.authTagB64,
    ciphertextB64: row.ciphertextB64,
    encryptedSymmetricKeyB64: row.encryptedSymmetricKeyB64,
    plaintextHashHex: row.plaintextHashHex,
    signatureB64: row.signatureB64,
    signatureInputVersion:
      row.signatureInputVersion as MessagePayload['signatureInputVersion'],
    encoding: {
      binaryToText:
        row.encodingBinaryToText as MessagePayload['encoding']['binaryToText'],
      textualPayload:
        row.encodingTextualPayload as MessagePayload['encoding']['textualPayload'],
      signatureInput:
        row.encodingSignatureInput as MessagePayload['encoding']['signatureInput'],
    },
  };
};

const mapRowToVerdict = (row: MessageRow): VerificationVerdict | null => {
  if (
    row.accepted === null ||
    row.decryptionSucceeded === null ||
    row.integrityValid === null ||
    row.signatureValid === null ||
    row.reasonCode === null ||
    row.humanSummary === null
  ) {
    return null;
  }

  return {
    accepted: row.accepted,
    decryptionSucceeded: row.decryptionSucceeded,
    integrityValid: row.integrityValid,
    signatureValid: row.signatureValid,
    failureStage: row.failureStage as VerificationVerdict['failureStage'],
    reasonCode: row.reasonCode as VerificationVerdict['reasonCode'],
    humanSummary: row.humanSummary,
  };
};

const mapRowToTransportFailure = (row: MessageRow): TransportFailure | null => {
  if (
    row.transportFailureCode === null ||
    row.transportFailureMessage === null
  ) {
    return null;
  }

  return {
    code: row.transportFailureCode as TransportFailure['code'],
    message: row.transportFailureMessage,
    statusCode: row.transportFailureStatusCode,
  };
};

const mapEventRow = (row: MessageEventRow): MessageEvent => {
  return {
    messageId: row.messageId,
    actor: row.actor as MessageEvent['actor'],
    stage: row.stage as MessageEvent['stage'],
    status: row.status as MessageEvent['status'],
    summary: row.summary,
    details: deserializeDetails(row.detailsJson),
    timestamp: row.createdAt,
  };
};

export interface PreparedMessageRecord {
  payload: MessagePayload;
  plaintext: string;
  events: MessageEvent[];
}

export interface ProcessedMessageRecord {
  payload: MessagePayload;
  plaintext?: string | null;
  decryptedPlaintext: string | null;
  verdict: VerificationVerdict;
  events: MessageEvent[];
  processedAt: string;
}

export interface TransportFailureRecord {
  messageId: string;
  transportFailure: TransportFailure;
  events: MessageEvent[];
  processedAt: string;
}

export interface MessageSummaryRecord {
  messageId: string;
  senderId: string;
  recipientId: string;
  createdAt: string;
  processedAt: string | null;
  lifecycleState: MessageLifecycleState;
  verdict: VerificationVerdict | null;
}

export interface MessageDetailRecord {
  payload: MessagePayload;
  plaintext: string | null;
  decryptedPlaintext: string | null;
  verdict: VerificationVerdict | null;
  transportFailure: TransportFailure | null;
  lifecycleState: MessageLifecycleState;
  createdAt: string;
  processedAt: string | null;
  events: MessageEvent[];
}

export interface MessageRepository {
  createPreparedMessage: (input: PreparedMessageRecord) => void;
  appendEvents: (messageId: string, events: MessageEvent[]) => void;
  markTransportFailure: (input: TransportFailureRecord) => void;
  finalizeProcessedMessage: (input: ProcessedMessageRecord) => void;
  listMessages: () => MessageSummaryRecord[];
  findMessageDetail: (messageId: string) => MessageDetailRecord | null;
}

export const createMessageRepository = (
  databaseClient: DatabaseClient,
): MessageRepository => {
  return {
    createPreparedMessage: (input) => {
      databaseClient.db.transaction((transaction) => {
        transaction
          .insert(messagesTable)
          .values({
            id: input.payload.messageId,
            ...toPayloadColumns(input.payload),
            lifecycleState: 'prepared',
            plaintext: input.plaintext,
            decryptedPlaintext: null,
            accepted: null,
            decryptionSucceeded: null,
            integrityValid: null,
            signatureValid: null,
            failureStage: null,
            reasonCode: null,
            humanSummary: null,
            transportFailureCode: null,
            transportFailureMessage: null,
            transportFailureStatusCode: null,
            createdAt: input.payload.timestamp,
            processedAt: null,
          })
          .run();

        if (input.events.length > 0) {
          transaction
            .insert(messageEventsTable)
            .values(input.events.map((event) => toEventInsert(event)))
            .run();
        }
      });
    },
    appendEvents: (messageId, events) => {
      if (events.length === 0) {
        return;
      }

      databaseClient.db.transaction((transaction) => {
        const existingMessage = transaction
          .select({ id: messagesTable.id })
          .from(messagesTable)
          .where(eq(messagesTable.id, messageId))
          .get();

        if (!existingMessage) {
          return;
        }

        transaction
          .insert(messageEventsTable)
          .values(events.map((event) => toEventInsert(event)))
          .run();
      });
    },
    markTransportFailure: (input) => {
      databaseClient.db.transaction((transaction) => {
        transaction
          .update(messagesTable)
          .set({
            lifecycleState: 'send_failed',
            transportFailureCode: input.transportFailure.code,
            transportFailureMessage: input.transportFailure.message,
            transportFailureStatusCode: input.transportFailure.statusCode,
            processedAt: input.processedAt,
          })
          .where(eq(messagesTable.id, input.messageId))
          .run();

        if (input.events.length > 0) {
          transaction
            .insert(messageEventsTable)
            .values(input.events.map((event) => toEventInsert(event)))
            .run();
        }
      });
    },
    finalizeProcessedMessage: (input) => {
      databaseClient.db.transaction((transaction) => {
        const existingMessage = transaction
          .select({ id: messagesTable.id })
          .from(messagesTable)
          .where(eq(messagesTable.id, input.payload.messageId))
          .get();

        const updateShape = {
          ...toPayloadColumns(input.payload),
          lifecycleState: 'processed' as const,
          decryptedPlaintext: input.decryptedPlaintext,
          accepted: input.verdict.accepted,
          decryptionSucceeded: input.verdict.decryptionSucceeded,
          integrityValid: input.verdict.integrityValid,
          signatureValid: input.verdict.signatureValid,
          failureStage: input.verdict.failureStage,
          reasonCode: input.verdict.reasonCode,
          humanSummary: input.verdict.humanSummary,
          transportFailureCode: null,
          transportFailureMessage: null,
          transportFailureStatusCode: null,
          processedAt: input.processedAt,
        };

        if (existingMessage) {
          transaction
            .update(messagesTable)
            .set({
              ...updateShape,
              ...(input.plaintext !== undefined
                ? { plaintext: input.plaintext }
                : {}),
            })
            .where(eq(messagesTable.id, input.payload.messageId))
            .run();
        } else {
          transaction
            .insert(messagesTable)
            .values({
              id: input.payload.messageId,
              ...updateShape,
              plaintext: input.plaintext ?? null,
              createdAt: input.payload.timestamp,
            })
            .run();
        }

        if (input.events.length > 0) {
          transaction
            .insert(messageEventsTable)
            .values(input.events.map((event) => toEventInsert(event)))
            .run();
        }
      });
    },
    listMessages: () => {
      const orderedAt = sql<string>`coalesce(${messagesTable.processedAt}, ${messagesTable.createdAt})`;
      const rows = databaseClient.db
        .select()
        .from(messagesTable)
        .orderBy(desc(orderedAt), desc(messagesTable.createdAt))
        .all();

      return rows.map((row) => ({
        messageId: row.id,
        senderId: row.senderId,
        recipientId: row.recipientId,
        createdAt: row.createdAt,
        processedAt: row.processedAt,
        lifecycleState: row.lifecycleState as MessageLifecycleState,
        verdict: mapRowToVerdict(row),
      }));
    },
    findMessageDetail: (messageId) => {
      const messageRow = databaseClient.db
        .select()
        .from(messagesTable)
        .where(eq(messagesTable.id, messageId))
        .get();

      if (!messageRow) {
        return null;
      }

      const eventRows = databaseClient.db
        .select()
        .from(messageEventsTable)
        .where(eq(messageEventsTable.messageId, messageId))
        .orderBy(asc(messageEventsTable.createdAt), asc(messageEventsTable.id))
        .all();

      return {
        payload: mapRowToPayload(messageRow),
        plaintext: messageRow.plaintext,
        decryptedPlaintext: messageRow.decryptedPlaintext,
        verdict: mapRowToVerdict(messageRow),
        transportFailure: mapRowToTransportFailure(messageRow),
        lifecycleState: messageRow.lifecycleState as MessageLifecycleState,
        createdAt: messageRow.createdAt,
        processedAt: messageRow.processedAt,
        events: eventRows.map((row) => mapEventRow(row)),
      };
    },
  };
};
