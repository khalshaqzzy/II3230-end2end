PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`sender_id` text NOT NULL,
	`recipient_id` text NOT NULL,
	`source_ip` text NOT NULL,
	`destination_ip` text NOT NULL,
	`timestamp` text NOT NULL,
	`symmetric_algorithm` text NOT NULL,
	`asymmetric_encryption_algorithm` text NOT NULL,
	`signature_algorithm` text NOT NULL,
	`hash_algorithm` text NOT NULL,
	`iv_b64` text NOT NULL,
	`auth_tag_b64` text NOT NULL,
	`ciphertext_b64` text NOT NULL,
	`encrypted_symmetric_key_b64` text NOT NULL,
	`plaintext_hash_hex` text NOT NULL,
	`signature_b64` text NOT NULL,
	`signature_input_version` text NOT NULL,
	`encoding_binary_to_text` text NOT NULL,
	`encoding_textual_payload` text NOT NULL,
	`encoding_signature_input` text NOT NULL,
	`lifecycle_state` text NOT NULL,
	`plaintext` text,
	`decrypted_plaintext` text,
	`accepted` integer,
	`decryption_succeeded` integer,
	`integrity_valid` integer,
	`signature_valid` integer,
	`failure_stage` text,
	`reason_code` text,
	`human_summary` text,
	`transport_failure_code` text,
	`transport_failure_message` text,
	`transport_failure_status_code` integer,
	`created_at` text NOT NULL,
	`processed_at` text
);
--> statement-breakpoint
INSERT INTO `__new_messages`("id", "sender_id", "recipient_id", "source_ip", "destination_ip", "timestamp", "symmetric_algorithm", "asymmetric_encryption_algorithm", "signature_algorithm", "hash_algorithm", "iv_b64", "auth_tag_b64", "ciphertext_b64", "encrypted_symmetric_key_b64", "plaintext_hash_hex", "signature_b64", "signature_input_version", "encoding_binary_to_text", "encoding_textual_payload", "encoding_signature_input", "lifecycle_state", "plaintext", "decrypted_plaintext", "accepted", "decryption_succeeded", "integrity_valid", "signature_valid", "failure_stage", "reason_code", "human_summary", "transport_failure_code", "transport_failure_message", "transport_failure_status_code", "created_at", "processed_at") SELECT "id", "sender_id", "recipient_id", "source_ip", "destination_ip", "timestamp", "symmetric_algorithm", "asymmetric_encryption_algorithm", "signature_algorithm", "hash_algorithm", "iv_b64", "auth_tag_b64", "ciphertext_b64", "encrypted_symmetric_key_b64", "plaintext_hash_hex", "signature_b64", "signature_input_version", "encoding_binary_to_text", "encoding_textual_payload", "encoding_signature_input", 'processed', "plaintext", "decrypted_plaintext", "accepted", "decryption_succeeded", "integrity_valid", "signature_valid", "failure_stage", "reason_code", "human_summary", NULL, NULL, NULL, "created_at", "processed_at" FROM `messages`;--> statement-breakpoint
DROP TABLE `messages`;--> statement-breakpoint
ALTER TABLE `__new_messages` RENAME TO `messages`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `messages_processed_at_idx` ON `messages` (`processed_at`);--> statement-breakpoint
CREATE INDEX `messages_lifecycle_state_idx` ON `messages` (`lifecycle_state`);--> statement-breakpoint
CREATE INDEX `messages_reason_code_idx` ON `messages` (`reason_code`);
