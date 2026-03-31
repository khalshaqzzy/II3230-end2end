import { asc, desc, eq } from 'drizzle-orm';

import type {
  MessageEvent,
  MessagePayload,
  VerificationVerdict,
} from '@ii3230/shared';

import type { DatabaseClient } from '../../db/client';
import {
  type MessageEventRow,
  type MessageRow,
  messageEventsTable,
  messagesTable,
} from '../../db/schema';
import type { ProcessedMessageRecord } from './types';

const serializeDetails = (details: MessageEvent['details']): string => {
  return JSON.stringify(details);
};

const deserializeDetails = (value: string): MessageEvent['details'] => {
  return JSON.parse(value) as MessageEvent['details'];
};

const toMessageInsert = (input: ProcessedMessageRecord) => {
  return {
    id: input.payload.messageId,
    senderId: input.payload.senderId,
    recipientId: input.payload.recipientId,
    sourceIp: input.payload.sourceIp,
    destinationIp: input.payload.destinationIp,
    timestamp: input.payload.timestamp,
    symmetricAlgorithm: input.payload.algorithms.symmetric,
    asymmetricEncryptionAlgorithm:
      input.payload.algorithms.asymmetricEncryption,
    signatureAlgorithm: input.payload.algorithms.signature,
    hashAlgorithm: input.payload.algorithms.hash,
    ivB64: input.payload.ivB64,
    authTagB64: input.payload.authTagB64,
    ciphertextB64: input.payload.ciphertextB64,
    encryptedSymmetricKeyB64: input.payload.encryptedSymmetricKeyB64,
    plaintextHashHex: input.payload.plaintextHashHex,
    signatureB64: input.payload.signatureB64,
    signatureInputVersion: input.payload.signatureInputVersion,
    encodingBinaryToText: input.payload.encoding.binaryToText,
    encodingTextualPayload: input.payload.encoding.textualPayload,
    encodingSignatureInput: input.payload.encoding.signatureInput,
    plaintext: input.plaintext,
    decryptedPlaintext: input.decryptedPlaintext,
    accepted: input.verdict.accepted,
    decryptionSucceeded: input.verdict.decryptionSucceeded,
    integrityValid: input.verdict.integrityValid,
    signatureValid: input.verdict.signatureValid,
    failureStage: input.verdict.failureStage,
    reasonCode: input.verdict.reasonCode,
    humanSummary: input.verdict.humanSummary,
    createdAt: input.payload.timestamp,
    processedAt: input.processedAt,
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

const mapRowToVerdict = (row: MessageRow): VerificationVerdict => {
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

export interface MessageSummaryRecord {
  messageId: string;
  senderId: string;
  recipientId: string;
  createdAt: string;
  processedAt: string;
  accepted: boolean;
  reasonCode: VerificationVerdict['reasonCode'];
  failureStage: VerificationVerdict['failureStage'];
}

export interface MessageDetailRecord {
  payload: MessagePayload;
  plaintext: string | null;
  decryptedPlaintext: string | null;
  verdict: VerificationVerdict;
  createdAt: string;
  processedAt: string;
  events: MessageEvent[];
}

export interface BobRepository {
  saveProcessedMessage: (input: ProcessedMessageRecord) => void;
  listMessages: () => MessageSummaryRecord[];
  findMessageDetail: (messageId: string) => MessageDetailRecord | null;
}

export const createBobRepository = (
  databaseClient: DatabaseClient,
): BobRepository => {
  return {
    saveProcessedMessage: (input) => {
      databaseClient.db.transaction((transaction) => {
        transaction.insert(messagesTable).values(toMessageInsert(input)).run();

        if (input.events.length === 0) {
          return;
        }

        transaction
          .insert(messageEventsTable)
          .values(input.events.map((event) => toEventInsert(event)))
          .run();
      });
    },
    listMessages: () => {
      const rows = databaseClient.db
        .select({
          messageId: messagesTable.id,
          senderId: messagesTable.senderId,
          recipientId: messagesTable.recipientId,
          createdAt: messagesTable.createdAt,
          processedAt: messagesTable.processedAt,
          accepted: messagesTable.accepted,
          reasonCode: messagesTable.reasonCode,
          failureStage: messagesTable.failureStage,
        })
        .from(messagesTable)
        .orderBy(desc(messagesTable.processedAt))
        .all();

      return rows.map((row) => ({
        ...row,
        reasonCode: row.reasonCode as VerificationVerdict['reasonCode'],
        failureStage: row.failureStage as VerificationVerdict['failureStage'],
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
        createdAt: messageRow.createdAt,
        processedAt: messageRow.processedAt,
        events: eventRows.map((row) => mapEventRow(row)),
      };
    },
  };
};
