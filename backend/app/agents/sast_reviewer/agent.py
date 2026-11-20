from app.agents.base_agent import BaseAgent
from app.tools.source_verifier import scan


class SastReviewerAgent(BaseAgent):
    id, name = "sast", "SAST Code Reviewer"

    async def run(self, st):
        self.working("Running static analysis rules")
        mine = [f for f in scan(st.mission.code) if f["agent"] == "sast"]
        self.screen([("SAST findings", "info")] + [
            (f"L{f['line']:<3} {f['cwe']} {f['title'][:34]}", "bad" if f["severity"] == "critical" else "warn")
            for f in mine[:10]])
        await self.think()
        self.done(f"{len(mine)} code-level vulnerabilities")
        return mine
