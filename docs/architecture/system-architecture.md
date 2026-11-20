# System architecture

Browser (React + Three.js) <-- WebSocket /ws/dashboard --> FastAPI `Hub` (in-memory state) <-- pipeline (asyncio).

1. UI posts source code (`POST /missions`) and presses Run (`POST /missions/{id}/run`).
2. Manager ingests the file into `workspace/<id>/original/` (the original is never touched).
3. Risk Assessor + SAST run in parallel, Pentester consolidates, Crypto runs its secret scan.
4. **Human checkpoint**: pipeline awaits `POST /approvals`.
   - Reject: status `rejected`, UI shows the overview report only. Nothing is written.
   - Approve: `./sandbox/` is created; Implementer then Crypto write hardened code there.
5. Manager re-scans `./sandbox/` (syntax + rules). Up to 2 remediation rounds; failures send a red paper handoff.
6. `AUDIT_REPORT.md` and `CHANGES.diff` are written to `./sandbox/`.
