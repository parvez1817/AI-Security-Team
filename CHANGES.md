# Changes in this revision

## Pipeline failure: "Crypto agent produced invalid Python; sandbox left unchanged"
Root cause: the implementer step accepted an empty / truncated / prose-only model reply (`ast.parse("")` passes),
wrote it to `./sandbox/Sample_test.py`, and the Crypto agent then rewrote that empty file and failed its syntax check.
- `backend/app/llm/base.py` - robust `extract_code` (reasoning blocks, unterminated fences), `check_python`, and
  `generate_python`, which validates and retries with the error fed back to the model.
- `backend/app/llm/grok_provider.py` - `max_tokens`, retry/backoff on 429/5xx/empty replies, low reasoning effort for gpt-oss.
- Implementer and Crypto agents use `generate_python`, verify that no endpoint was dropped, use their per-agent
  `MODEL_*` setting, and Crypto falls back to the original source if the sandbox file is empty.
- `backend/tests/unit/` - 16 tests (codegen retry logic + behavioural tests of the hardened app).

## Hardened `sandbox/Sample_test.py`
Fixes all 12 findings (CWE-798/89/862/78/502/256/330/639/200/306): env-only JWT secret (fails closed), parameterized SQL,
bcrypt hashing, signed expiring JWTs, RBAC on /admin and /diagnostics, ownership checks, JSON instead of pickle,
`subprocess` argument list with host validation, no password/token in responses, optional TOTP MFA, login lockout.
Run: `JWT_SECRET=<32+ chars> ADMIN_BOOTSTRAP_PASSWORD=<12+ chars> uvicorn Sample_test:app`

## Light theme of the 3D office
Cool light-grey room, glowing blue neon trim (layered halos), warm lamp / sconce / under-shelf glow, amber light pools
on a glossy floor (environment reflections), base plinth with neon lip, recessed centre wall panel, extra props
(plants, side table, hanging vines), bigger agent label pills, "Mission control" TV styled after the reference
(system health, stat tiles, activity overview) and code-filled idle monitors. Dark theme still works.
Files: `frontend/src/scene/{Office,SceneManager,Monitors,Characters}.js`, `frontend/dist/` rebuilt.
