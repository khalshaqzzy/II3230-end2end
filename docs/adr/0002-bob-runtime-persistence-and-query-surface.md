# 0002 Bob Runtime, Persistence, and Query Surface

Status: Accepted  
Date: 2026-03-31

## Context

Phase 0-1 froze the shared payload, verdict, event, environment, and cryptographic contracts in `packages/shared`, but the repository still lacked a real Bob-side runtime. The project needed a Bob target that could:

- receive a payload over HTTP
- execute unwrap, decrypt, integrity verification, and signature verification using the frozen shared contracts
- persist Bob-side evidence in a queryable form
- expose that evidence back through stable backend APIs for later CLI and UI phases

This phase also needed to resolve an implementation choice that was still open in the roadmap: whether persistence would remain deferred or be implemented immediately. The chosen approach had to preserve the primary local-LAN assignment path, avoid frontend-first drift, and reduce churn before Alice-side send tooling begins.

## Decision

The project now freezes the following Phase 2 decisions:

- implement Bob as an explicit HTTP receive target at `POST /internal/messages/receive`
- validate inbound payloads strictly against `messagePayloadSchema` before Bob-side processing begins
- implement Bob-side decryption and verification in the API service using the shared AES, RSA, hash, and signature helpers from `packages/shared`
- persist processed Bob messages and lifecycle events immediately using SQLite with Drizzle ORM and checked-in SQL migrations
- store the SQLite database at `${APP_DATA_DIR}/ii3230.sqlite`
- expose persisted evidence through `GET /messages` and `GET /messages/:messageId`
- load Alice public key material and Bob private key material during API bootstrap, and fail fast if runtime key files or database bootstrap are invalid
- sanitize persisted event details and query responses so private keys and raw symmetric keys never leave process memory

The Bob verdict precedence is also frozen for this architecture slice:

- symmetric-key unwrap failure maps to `decryption_failed` at `decrypt_symmetric_key`
- ciphertext decryption failure maps to `decryption_failed` at `decrypt_ciphertext`
- plaintext hash mismatch takes precedence over signature failure and maps to `integrity_check_failed` at `verify_hash`
- signature failure with valid decryption and integrity maps to `signature_verification_failed` at `verify_signature`
- only a payload that passes all Bob-side checks is marked `accepted`

## Rationale

- an explicit Bob receive endpoint preserves the assignment narrative of Alice sending to Bob across an IP-addressable runtime target
- immediate persistence eliminates a later refactor from temporary in-memory state to real evidence storage
- SQLite keeps the deployment shape small and matches the PRD minimum version for a single-VM and local-LAN-friendly backend
- Drizzle provides typed schema ownership and migration discipline without introducing a separate database service
- stable read APIs let later Alice CLI and frontend work reuse Bob-side evidence instead of inventing parallel inspection paths
- fail-fast bootstrap protects the demo flow from hidden runtime misconfiguration
- mandatory sanitization prevents accidental leakage of key material while still preserving enough evidence for reporting and demos

## Consequences

- the API runtime now depends on SQLite availability in `APP_DATA_DIR` and on checked-in Drizzle migrations being present at startup
- later phases should reuse `GET /messages` and `GET /messages/:messageId` for evidence retrieval instead of creating duplicate read models
- Alice-side Phase 3 work should target Bob by sending a valid shared `MessagePayload` to `POST /internal/messages/receive`
- the backend now owns a durable persistence boundary in `apps/api/src/db` and `apps/api/src/modules/*`, so future phases should extend those modules instead of bypassing them
- malformed payloads are API validation errors, while cryptographically invalid payloads are processed Bob verdicts that must still be persisted for observability
- any future attempt to replace SQLite, remove the explicit Bob receive route, or change verdict precedence should be treated as a new ADR-worthy decision

## Follow-Up

- implement Alice-side message assembly and send tooling in Phase 3 against the frozen Bob receive surface
- add Alice-side event persistence and correlate it with the Bob-side message records
- keep frontend and VM rollout work deferred until Alice-to-Bob LAN-targeted flows are stable
