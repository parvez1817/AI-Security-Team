from app.agents.base_agent import BaseAgent
from app.agents.security_implementer.prompts import SYSTEM
from app.llm.base import check_python, generate_python
from app.llm.factory import get_llm
from app.tools.source_verifier import route_set

REQS = "fastapi\nuvicorn\nbcrypt\nPyJWT\npyotp\n"


class SecurityImplementerAgent(BaseAgent):
    id, name = "implementer", "Security Implementer"

    async def run(self, st, remaining=None):
        fn = st.mission.filename
        self.working("Writing hardened code to ./sandbox/")
        src = st.sandbox.read(fn) if remaining else st.mission.code
        issues = remaining or [f for f in self.hub.board["findings"] if f["agent"] != "crypto"]
        listing = "\n".join(f"- L{f['line']} {f['cwe']} {f['title']}" for f in issues)
        expected = route_set(src)

        def validate(new: str) -> str | None:
            problem = check_python(new)
            missing = expected - route_set(new)
            if problem is None and missing:
                problem = "it dropped endpoints: " + ", ".join(f"{m} {p}" for m, p in sorted(missing)) + " - keep every endpoint"
            return problem

        new = await generate_python(get_llm(self.id), SYSTEM,
                                    f"Findings to fix:\n{listing}\n\nSource:\n```python\n{src}```", validate=validate)
        st.sandbox.write(fn, new)
        st.sandbox.write("requirements.txt", REQS)
        self.hub.board["fixes"].append(f"Implementer: rewrote {fn} ({len(new.splitlines())} lines) with auth, RBAC, validation")
        self.screen([("Sandbox write", "info"), (f"./sandbox/{fn}", "ok"), ("./sandbox/requirements.txt", "ok"),
                     (f"{len(issues)} findings addressed", "ok"), ("Original file untouched", "dim")])
        await self.think()
        self.done(f"Wrote ./sandbox/{fn}")
