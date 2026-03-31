# 0001 Phase 0-1 Foundation and Contract Freeze

Status: Accepted  
Date: 2026-03-31

## Context

The repository started as a documentation-only workspace for the II3230 secure message delivery project. The first implementation slice needed to create a stable execution base without forcing future phases to re-decide payload shape, event semantics, or cryptographic serialization details.

The project also needs a clear priority order:

- primary local-LAN correctness before hosted demo convenience
- backend and CLI contracts before frontend work
- shared cryptographic behavior before Bob and Alice pipelines diverge

## Decision

The project now freezes the following Phase 0-1 decisions:

- use an `npm` workspace monorepo with `apps/api`, `packages/shared`, `scripts`, and `docker`
- keep `packages/shared` as the single source of truth for payload, verdict, event, env, stage, and crypto contracts
- implement the initial API surface as an Express service with `GET /health` and `GET /ready`
- standardize the initial crypto profile on AES-256-GCM, RSA-OAEP with SHA-256, SHA-256 hashing, and RSA-PSS with SHA-256
- standardize canonical signature input through `buildCanonicalSignatureInput(...)` and forbid parallel serializers
- keep non-production key generation local and out of tracked repo files via `scripts/generate-local-keys.ts`

## Rationale

- shared contract freeze reduces churn before Bob receive, Alice send, persistence, and frontend work begin
- the selected crypto profile matches the preferred PRD defaults and is straightforward to explain in the assignment report
- the API-only bootstrap allows runtime checks and Docker packaging without frontloading UI work
- local key generation keeps private material out of git while still supporting repeatable development and tests

## Consequences

- later phases must import and reuse the shared payload, verdict, stage, and signature-input helpers instead of redefining them
- the payload now includes `authTagB64` because AES-GCM requires it for correct decryption
- future Bob and Alice flows should treat the canonical signature input as frozen unless a new ADR explicitly supersedes it
- the repo can remain compatible with the current local Node 20 environment even though the PRD prefers Node 22 LTS

## Follow-Up

- implement Bob receive and verification pipeline next
- introduce persistence for `messages` and `message_events` only after Phase 2 service behavior exists
- adapt deployment and hosted runtime documents later, after backend behavior is stable
