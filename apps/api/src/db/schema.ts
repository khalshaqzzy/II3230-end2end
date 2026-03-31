import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const messagesTable = sqliteTable(
  'messages',
  {
    id: text('id').primaryKey(),
    senderId: text('sender_id').notNull(),
    recipientId: text('recipient_id').notNull(),
    sourceIp: text('source_ip').notNull(),
    destinationIp: text('destination_ip').notNull(),
    timestamp: text('timestamp').notNull(),
    symmetricAlgorithm: text('symmetric_algorithm').notNull(),
    asymmetricEncryptionAlgorithm: text(
      'asymmetric_encryption_algorithm',
    ).notNull(),
    signatureAlgorithm: text('signature_algorithm').notNull(),
    hashAlgorithm: text('hash_algorithm').notNull(),
    ivB64: text('iv_b64').notNull(),
    authTagB64: text('auth_tag_b64').notNull(),
    ciphertextB64: text('ciphertext_b64').notNull(),
    encryptedSymmetricKeyB64: text('encrypted_symmetric_key_b64').notNull(),
    plaintextHashHex: text('plaintext_hash_hex').notNull(),
    signatureB64: text('signature_b64').notNull(),
    signatureInputVersion: text('signature_input_version').notNull(),
    encodingBinaryToText: text('encoding_binary_to_text').notNull(),
    encodingTextualPayload: text('encoding_textual_payload').notNull(),
    encodingSignatureInput: text('encoding_signature_input').notNull(),
    lifecycleState: text('lifecycle_state').notNull(),
    plaintext: text('plaintext'),
    decryptedPlaintext: text('decrypted_plaintext'),
    accepted: integer('accepted', { mode: 'boolean' }),
    decryptionSucceeded: integer('decryption_succeeded', {
      mode: 'boolean',
    }),
    integrityValid: integer('integrity_valid', { mode: 'boolean' }),
    signatureValid: integer('signature_valid', { mode: 'boolean' }),
    failureStage: text('failure_stage'),
    reasonCode: text('reason_code'),
    humanSummary: text('human_summary'),
    transportFailureCode: text('transport_failure_code'),
    transportFailureMessage: text('transport_failure_message'),
    transportFailureStatusCode: integer('transport_failure_status_code'),
    createdAt: text('created_at').notNull(),
    processedAt: text('processed_at'),
  },
  (table) => ({
    processedAtIdx: index('messages_processed_at_idx').on(table.processedAt),
    lifecycleStateIdx: index('messages_lifecycle_state_idx').on(
      table.lifecycleState,
    ),
    reasonCodeIdx: index('messages_reason_code_idx').on(table.reasonCode),
  }),
);

export const messageEventsTable = sqliteTable(
  'message_events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    messageId: text('message_id')
      .notNull()
      .references(() => messagesTable.id, { onDelete: 'cascade' }),
    actor: text('actor').notNull(),
    stage: text('stage').notNull(),
    status: text('status').notNull(),
    summary: text('summary').notNull(),
    detailsJson: text('details_json').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => ({
    messageIdCreatedAtIdx: index('message_events_message_id_created_at_idx').on(
      table.messageId,
      table.createdAt,
    ),
  }),
);

export type MessageRow = typeof messagesTable.$inferSelect;
export type NewMessageRow = typeof messagesTable.$inferInsert;
export type MessageEventRow = typeof messageEventsTable.$inferSelect;
export type NewMessageEventRow = typeof messageEventsTable.$inferInsert;
