import asyncio

from app.approvals.approval_manager import approvals
from app.config import settings
from app.llm.factory import get_llm
from app.orchestration.handoffs import handoff
from app.orchestration.routing import MAX_REMEDIATION_ROUNDS
from app.tools.file_manager import ScopedFS
from app.tools.source_verifier import overview


async def ingest(st):
    h, m = st.hub, st.mission
    st.manager.working("Ingesting source into the workspace")
    st.manager.stage("ingest")
    ScopedFS(settings.workspace_dir / m.id / "original").write(m.filename, m.code)
    h.board["overview"] = overview(m.code)
    await asyncio.sleep(1.5)


async def audit(st):
    h = st.hub
    st.manager.stage("audit")
    await handoff("manager", "risk", "Map endpoints and threats")
    await handoff("manager", "sast", "Run static analysis")
    risk, sast = await asyncio.gather(st.risk.run(st), st.sast.run(st))
    h.set_findings(risk + sast)
    await handoff("risk", "pentest", "Architecture findings for DAST")
    await handoff("sast", "pentest", "SAST findings for DAST")
    await st.pentest.run(st)
    await handoff("pentest", "manager", "Consolidated runtime and dependency audit")
    await handoff("manager", "crypto", "Secret and data-protection scan")
    crypto = await st.crypto.audit(st)
    h.set_findings(h.board["findings"] + crypto)
    await handoff("crypto", "manager", "Crypto findings")


async def human_checkpoint(st) -> bool:
    h = st.hub
    h.board["plan"] = st.manager.plan(h.board["findings"])
    st.manager.stage("approval")
    st.mission.status = "waiting_approval"
    h.emit("manager", "waiting", "Waiting for human approval before writing to ./sandbox/")
    approved = await approvals.wait_for_decision()
    if not approved:
        h.emit("manager", "rejected", "Human rejected the write. Report only, nothing written")
    return approved


async def remediate(st, remaining=None):
    get_llm()  # fail early with a clear message if XAI_API_KEY is missing
    await handoff("manager", "implementer", "Fix auth, RBAC, injection flaws" if not remaining else "Re-fix remaining findings", rejected=bool(remaining))
    await st.implementer.run(st, remaining)
    await handoff("implementer", "crypto", "Harden crypto and secrets")
    await st.crypto.run(st)
    await handoff("crypto", "manager", "Sandbox ready for verification")


async def verify_loop(st):
    h = st.hub
    st.manager.stage("verify")
    for attempt in range(1, MAX_REMEDIATION_ROUNDS + 1):
        st.manager.working(f"Verification scan of ./sandbox/ (round {attempt})")
        res = st.manager.verify(st)
        h.board["verification"] = {**res, "attempts": attempt}
        checks = [("syntax valid", res["syntax_ok"]), ("no critical/high findings", not res["remaining"])]
        st.manager.screen([("Verification", "info")] + [(f"{'PASS' if ok else 'FAIL'}  {n}", "ok" if ok else "bad") for n, ok in checks]
                          + [(f"L{f['line']} {f['title'][:40]}", "bad") for f in res["remaining"][:6]])
        if res["passed"] or attempt == MAX_REMEDIATION_ROUNDS:
            break
        await remediate(st, res["remaining"])
