# 0003 Message Lifecycle and Alice Orchestration

Status: Accepted  
Date: 2026-03-31

## Context

Phase 2 introduced Bob-side persistence and query APIs, but the storage boundary was still Bob-centric: a message row only existed after Bob had already finished processing a payload. Phase 3 needed to add:

- Alice-side payload preparation
- a stable `POST /messages` orchestration surface for later UI and demo entrypoints
- transport failure reporting when Bob is unreachable
- a correlated event trail that begins before Bob receives the payload

Keeping persistence inside a Bob-only repository would have forced Alice-side logic either to bypass the database, create parallel tables, or duplicate read models later for UI and CLI flows. The project needed one stable lifecycle model that could represent Alice-prepared, Bob-processed, and Bob-unreachable cases under the same `messageId`.

## Decision

The project now freezes the following Phase 3 decisions:

- add an explicit Alice orchestration route at `POST /messages`
- keep `POST /internal/messages/receive` as the raw Bob receive endpoint for direct CLI sends, tamper tests, and Alice orchestration handoff
- replace the Bob-specific repository with a lifecycle-aware message repository under `apps/api/src/modules/messages/`
- store one message row per `messageId` across the states `prepared`, `processed`, and `send_failed`
- persist Alice and Bob events in the same `message_events` table so query surfaces return one unified timeline
- extend runtime key loading so the API runtime can access Alice private key material and Bob public key material in addition to the Phase 2 Bob-side material
- add transport-failure metadata to the message record instead of forcing transport errors into `VerificationVerdict`
- expose lifecycle state, nullable verdict, and nullable transport failure through `GET /messages` and `GET /messages/:messageId`

The CLI shape is also frozen for this slice:

- `manual-send.ts` is the primary Alice-side LAN and remote-target send path
- `manual-fetch-message.ts` and `manual-fetch-logs.ts` reuse the existing read APIs
- `manual-tamper.ts` continues to target the raw Bob receive route

## Rationale

- one lifecycle-aware repository prevents drift between Alice orchestration, Bob verification, and later UI read paths
- a dedicated `POST /messages` route gives the public UI and future demos a stable backend entrypoint without changing the raw Bob target used for assignment validation
- separating transport failures from cryptographic verdicts keeps Bob verification semantics clean and machine-readable
- unified timelines make report extraction and observability easier because Alice preparation and Bob verification live under the same correlated message record
- direct CLI sends to the Bob raw route preserve the assignment narrative of Alice running on one device and Bob listening on another IP-addressable target

## Consequences

- `apps/api/src/modules/bob/repository.ts` is no longer the persistence owner; future message storage changes should extend `apps/api/src/modules/messages/repository.ts`
- message query responses now require consumers to handle nullable `verdict` and nullable `transportFailure`
- database migrations must preserve older Phase 2 rows by backfilling them as `processed`
- runtime configuration now has one more operational assumption: Alice-side private key and Bob public key must both be available anywhere `POST /messages` runs
- later frontend work should target `POST /messages` for orchestration and reserve `POST /internal/messages/receive` for internal or operator-oriented flows

## Follow-Up

- prove the primary two-device LAN path using `manual-send.ts --target <bob-lan-url>`
- capture LAN happy-path and tamper-path evidence using the new fetch scripts
- defer VM deployment and frontend integration until the lifecycle-aware LAN proof is complete
