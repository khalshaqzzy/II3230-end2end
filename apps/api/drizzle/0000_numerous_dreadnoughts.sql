CREATE TABLE `message_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message_id` text NOT NULL,
	`actor` text NOT NULL,
	`stage` text NOT NULL,
	`status` text NOT NULL,
	`summary` text NOT NULL,
	`details_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `message_events_message_id_created_at_idx` ON `message_events` (`message_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `messages` (
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
	`plaintext` text,
	`decrypted_plaintext` text,
	`accepted` integer NOT NULL,
	`decryption_succeeded` integer NOT NULL,
	`integrity_valid` integer NOT NULL,
	`signature_valid` integer NOT NULL,
	`failure_stage` text,
	`reason_code` text NOT NULL,
	`human_summary` text NOT NULL,
	`created_at` text NOT NULL,
	`processed_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `messages_processed_at_idx` ON `messages` (`processed_at`);--> statement-breakpoint
CREATE INDEX `messages_reason_code_idx` ON `messages` (`reason_code`);