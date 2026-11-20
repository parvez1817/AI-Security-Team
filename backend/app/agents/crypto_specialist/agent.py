import re

from app.agents.base_agent import BaseAgent
from app.agents.crypto_specialist.prompts import SYSTEM
from app.llm.base import check_python, generate_python
from app.llm.factory import get_llm
from app.tools.source_verifier import route_set, scan


class CryptoSpecialistAgent(BaseAgent):
    id, name = "crypto", "Crypto & Data Security"

    async def audit(self, st):
        self.working("Secret scan and data-protection audit")
        mine = [f for f in scan(st.mission.code) if f["agent"] == "crypto"]
        self.screen([("Secret / data audit", "info")] + [
            (f"L{f['line']:<3} {f['cwe']} {f['title'][:34]}", "bad" if f["severity"] == "critical" else "warn")
            for f in mine[:10]])
        await self.think()
        self.done(f"{len(mine)} secret/data-protection issues")
        return mine

    async def run(self, st):
        self.working("Replacing plaintext passwords with bcrypt, stripping secrets")
        code = st.sandbox.read(st.mission.filename)
        if len(code.strip().splitlines()) < 5:  # implementer output was lost - fall back to the audited original
            code = st.mission.code
        expected = route_set(code)

        def validate(new: str) -> str | None:
            problem = check_python(new)
            missing = expected - route_set(new)
            if problem is None and missing:
                problem = "it dropped endpoints: " + ", ".join(f"{m} {p}" for m, p in sorted(missing)) + " - keep every endpoint"
            return problem

        new = await generate_python(get_llm(self.id), SYSTEM, f"```python\n{code}```", validate=validate)
        st.sandbox.write(st.mission.filename, new)
        st.sandbox.write(".env.example", "JWT_SECRET=change-me-long-random-value\nADMIN_BOOTSTRAP_PASSWORD=change-me\n")
        left = [f for f in scan(new) if f["agent"] == "crypto"]
        checks = [("bcrypt/argon2 hashing", bool(re.search(r"bcrypt|argon2", new))),
                  ("constant-time compare", bool(re.search(r"checkpw|compare_digest|verify\(", new))),
                  ("secrets from environment", "environ" in new or "getenv" in new),
                  ("no hardcoded secrets", not any(f["id"] == "HARDCODED_SECRET" for f in left)),
                  ("no password/token in responses", not any(f["id"] in ("PLAINTEXT_PASSWORD", "TOKEN_EXPOSURE") for f in left))]
        self.screen([("Crypto audit", "info")] + [(f"{'PASS' if ok else 'FAIL'}  {n}", "ok" if ok else "bad") for n, ok in checks])
        self.hub.board["fixes"].append("Crypto: salted bcrypt hashing, env-based secrets, hashed API tokens")
        await self.think()
        self.done(f"{sum(ok for _, ok in checks)}/{len(checks)} crypto checks pass")
