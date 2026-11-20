from app.agents.base_agent import BaseAgent
from app.agents.risk_assessor.prompts import SYSTEM
from app.config import settings
from app.llm.factory import get_llm
from app.tools.source_verifier import analyze_routes, scan


class RiskAssessorAgent(BaseAgent):
    id, name = "risk", "Risk Assessor"

    async def run(self, st):
        code = st.mission.code
        self.working("Threat-modeling endpoints and business logic")
        routes = analyze_routes(code)
        self.hub.board["routes"] = routes
        mine = [f for f in scan(code) if f["agent"] == "risk"]
        lines = [("Endpoint map", "info")] + [
            (f"{'OK ' if r['guarded'] or r['public'] else '!! '}{r['method']:6} {r['path']}",
             "ok" if r["guarded"] or r["public"] else "bad") for r in routes[:8]]
        self.screen(lines + [(f"{len(mine)} risks found", "warn")])
        if settings.xai_api_key:
            try:
                self.hub.board["threat_model"] = await get_llm().chat(SYSTEM, code)
            except Exception:  # optional enrichment only
                pass
        await self.think()
        self.done(f"{len(mine)} architecture/auth risks found")
        return mine
