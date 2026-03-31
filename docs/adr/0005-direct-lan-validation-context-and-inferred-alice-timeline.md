# 0005 Direct LAN Validation Context and Inferred Alice Timeline

Status: Accepted  
Date: 2026-03-31

## Context

Phase 4 established the direct Bob receive route at `POST /internal/messages/receive` as the canonical validation path for two-device LAN testing. That path is ideal for assignment-aligned testing, but it originally had two observability gaps:

- persisted event logs were Bob-centric, so direct LAN runs did not retain a full Alice-to-Bob timeline
- testing runs did not persist enough request and scenario context to make replay, debugging, and report evidence straightforward

This left the project in an awkward state where the recommended LAN validation path was technically correct but less observable than the monolith-oriented `POST /messages` orchestration path.

## Decision

The project now freezes the following decisions for direct LAN validation:

- direct Bob receive runs must persist an inferred Alice timeline when the message does not already exist in the lifecycle-aware repository
- the inferred Alice timeline must cover:
  - `receive_plaintext`
  - `generate_symmetric_key`
  - `encrypt_plaintext`
  - `encrypt_symmetric_key`
  - `generate_hash`
  - `generate_signature`
  - `send_payload`
- Bob receive events must persist request-origin context when available, including:
  - actual requester IP
  - socket remote address
  - forwarded-for header
  - user agent
- testing-oriented runs must persist validation metadata when supplied, including:
  - validation mode
  - test run id
  - scenario name
- the happy-path and tamper harnesses are responsible for sending that metadata through explicit request headers
- direct LAN message detail should retain decrypted plaintext as stored evidence when Bob successfully processes the payload

## Rationale

- the assignment and report both benefit from one readable end-to-end story even when Alice sends directly to Bob
- inferred Alice events are a better fit than forcing testers to switch to `POST /messages`, which would weaken the LAN-targeted narrative
- persisted test metadata makes it easier to distinguish one rehearsal from another and makes artifact review less ambiguous
- request-origin context gives testers and reviewers a clearer picture of how the payload actually reached Bob, instead of relying only on logical IP fields inside the payload

## Consequences

- direct LAN logs now intentionally mix inferred Alice-side observability with actual Bob-side processing events
- reviewers must understand that some Alice events in the direct Bob path are reconstructed from the received payload, not captured from a running Alice service
- testing harnesses and manual operator tools should continue to send validation metadata so logs remain high-signal
- future work should not remove these direct-LAN observability additions unless a replacement path preserves equivalent evidence quality

## Follow-Up

- keep the tester-facing runbook aligned with the new `testRunId`, scenario, and request-context logging behavior
- preserve this metadata in future UI and export surfaces so LAN evidence remains useful outside raw JSON inspection
