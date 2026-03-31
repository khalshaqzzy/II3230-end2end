# Directory Guide
Purpose: source code directory map for the II3230 end-to-end secure message delivery repository.

Document status: Active  
Created: 2026-03-31

## 1. Root Layout

```text
apps/
  api/
docker/
docs/
  adr/
drafts/
internals/
packages/
  shared/
scripts/
```

## 2. Source Code Directories

### `apps/api/`

Primary runtime application for the backend/API.

- `src/app.ts`
  - Express application setup
  - health and readiness routes
- `src/server.ts`
  - HTTP server bootstrap
- `src/config/`
  - runtime environment parsing and config bootstrap
- `src/logger.ts`
  - Pino logger factory
- `src/*.test.ts`
  - API-level tests

Generated output:

- `dist/`
  - compiled JavaScript and declaration output
  - not source of truth

### `packages/shared/`

Shared contracts and crypto primitives used across runtime surfaces.

- `src/contracts/`
  - payload schema
  - verdict schema
  - message event schema
  - identity and environment schemas
  - stage and status enums
- `src/crypto/`
  - AES, RSA, hashing, signature, masking, sanitization, and canonical signature-input helpers
- `src/index.ts`
  - shared package export surface
- `src/shared.test.ts`
  - shared unit tests

Generated output:

- `dist/`
  - compiled shared package output
  - not source of truth

### `scripts/`

Operator and local-development scripts.

- `generate-local-keys.ts`
  - local non-production RSA key generation

### `docker/`

Local and later deployment container orchestration files.

- `compose.local.yml`
  - API-only local Compose bootstrap for the current implementation slice

## 3. Documentation Directories

### `docs/`

Engineering documentation that belongs with the implementation.

- `directory.md`
  - this source code directory map
- `adr/`
  - architecture decision records that freeze durable technical choices

### `internals/`

Project memory for future Codex sessions.

- product and planning documents
- session handoffs
- phase backlog and kickoff files

These files are for continuity and execution planning, not runtime behavior.

### `drafts/`

Reference deployment artifacts from earlier exploration.

- not source of truth
- not production-ready for this project as-is

## 4. Local-Only and Generated Directories

### `.local/`

Local generated assets that should not be treated as tracked source.

- `keys/`
  - locally generated Alice/Bob keypairs for development and testing

### `node_modules/`

Installed dependencies. Never treat this as source code.

## 5. Current Source-of-Truth Boundaries

- backend runtime behavior: `apps/api/src/`
- shared contracts and crypto behavior: `packages/shared/src/`
- implementation decisions: `docs/adr/`
- product/roadmap/session memory: `internals/`


