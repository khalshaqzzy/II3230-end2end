# 0004 Phase 4 LAN Validation and Role-Aware Operator Runtime

Status: Accepted  
Date: 2026-03-31

## Context

Phase 3 left the project with a strong functional baseline, but the operator path for the canonical assignment validation was still too monolithic:

- Alice-side scripts loaded more key material than they actually needed
- Bob runtime startup still assumed an Alice-private-key-capable environment
- local key paths were inconsistent between the generator and the runtime expectations
- there was no stable Bob launcher for testers running one device as the receiver
- there was no repeatable artifact-producing harness for happy-path and tamper-path LAN validation

The assignment requires a clear Alice-on-one-host and Bob-on-another-host narrative. Keeping one monolithic key-loading assumption would have made the LAN operator flow harder to explain, harder to secure operationally, and harder to rehearse on separate devices.

## Decision

The project now freezes the following Phase 4 decisions:

- split key loading by runtime role
  - Alice send-side tooling loads only Alice private/public keys plus Bob public key
  - Bob receive/runtime loads only Alice public key plus Bob private/public keys
  - monolith-capable loading remains available only as a compatibility path for later phases
- standardize local key placement under `.local/data/keys/`
- fix relative runtime path resolution so direct Node startup resolves project-relative files from the repo root
- allow Bob to run in a Bob-only operator mode where `POST /messages` is not mounted if Alice private key material is absent
- add an env-file aware Bob launcher at `npm run bob:lan`
- add env-file aware operator scripts for send, fetch-detail, fetch-logs, and tamper flows
- add automated Phase 4 harnesses for:
  - happy-path LAN validation
  - ciphertext tamper rejection
  - hash tamper rejection
  - signature tamper rejection
  - wrong-recipient-key rejection
- freeze the Phase 4 artifact contract under `artifacts/local-tests/<timestamp>/`
- document the tester-facing LAN workflow in `docs/local-lan-runbook.md`

## Rationale

- role-aware key loading matches the actual Alice/Bob trust boundaries and removes unnecessary private-key exposure from each device
- Bob-only startup gives testers a cleaner and more defensible “receiver host” story for the assignment
- one canonical key directory avoids drift between the generator, env files, and runtime
- env-file driven commands reduce setup mistakes during live testing and make the two-device flow easier for testers to repeat
- explicit happy-path and tamper harnesses produce stable evidence instead of forcing testers to rely on manual terminal reconstruction
- a frozen artifact directory contract makes report preparation and acceptance review more reliable

## Consequences

- future work should not make Alice-side scripts depend on Bob private key material again
- future work should not make Bob runtime depend on Alice private key material unless a new architecture decision explicitly requires it
- `.local/data/keys/` should remain the default local operator path unless a later ADR supersedes it
- LAN validation evidence should prefer the new harness outputs over ad hoc terminal transcripts
- `POST /internal/messages/receive` remains the canonical Bob validation target for two-device testing, even though `POST /messages` still exists for orchestration and later UI-facing flows
- later deployment and frontend phases should preserve the tester-facing flow instead of re-centering the project around the monolith path

## Follow-Up

- run the documented LAN flow on two physical devices and capture final screenshots plus generated artifacts
- begin Phase 5 VM backend packaging only after that physical rehearsal passes
- keep `drafts/` excluded from source-of-truth deployment and operator documentation
