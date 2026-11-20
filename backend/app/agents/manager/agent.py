import difflib

from app.agents.base_agent import BaseAgent
from app.tools.source_verifier import scan, syntax_ok

STAGES = [("ingest", "Ingest & map"), ("audit", "Audit (Risk, SAST, DAST)"), ("approval", "Human approval"),
          ("remediate", "Sandboxed remediation"), ("verify", "Verification pass")]
PLAN = {
    "MISSING_AUTH": "JWT auth guard on every non-public route", "MISSING_RBAC": "RBAC (admin role) on /admin/* routes",
    "IDOR": "Ownership checks on /users/{id}", "WEAK_TOKEN": "Signed, expiring JWT sessions (+ optional TOTP MFA)",
    "SQLI": "Parameterized SQL queries", "CMD_INJECTION": "Remove shell=True; validate host, argument-list subprocess",
    "PICKLE": "Replace pickle with safe JSON parsing", "HARDCODED_SECRET": "Move secrets to environment variables",
    "PLAINTEXT_PASSWORD": "bcrypt-hash passwords; stop returning them", "TOKEN_EXPOSURE": "Hash API tokens; never return them",
    "WEAK_HASH": "Replace MD5/SHA1 with bcrypt/Argon2id",
}


class ManagerAgent(BaseAgent):
    id, name = "manager", "Manager / Orchestrator"

    def stage(self, key):
        self.hub.board["stage"] = key
        keys = [k for k, _ in STAGES]
        i = keys.index(key) if key in keys else len(keys)
        self.screen([("Mission stages", "info")] + [
            (("DONE " if j < i else "NOW  " if j == i else "     ") + label, "ok" if j < i else "warn" if j == i else "dim")
            for j, (_, label) in enumerate(STAGES)])

    def plan(self, findings):
        items = list(dict.fromkeys(PLAN[f["id"]] for f in findings if f["id"] in PLAN))
        return [f"Write hardened code ONLY to ./sandbox/{self.hub.mission.filename} (original stays untouched)"] + items

    def verify(self, st):
        code = st.sandbox.read(st.mission.filename)
        left = [f for f in scan(code) if f["severity"] in ("critical", "high")]
        ok = syntax_ok(code)
        return {"passed": ok and not left, "syntax_ok": ok, "remaining": left}

    def write_outputs(self, st):
        fn, hub = st.mission.filename, self.hub
        diff = "".join(difflib.unified_diff(st.mission.code.splitlines(True), st.sandbox.read(fn).splitlines(True),
                                            f"original/{fn}", f"sandbox/{fn}"))
        hub.board["diff"] = diff
        st.sandbox.write("CHANGES.diff", diff)
        f = hub.board["findings"]
        report = [f"# Audit report - {fn}", "", "## Findings (original)"] + [
            f"- [{x['severity']}] {x['cwe']} L{x['line']}: {x['title']}" for x in f] + ["", "## Fixes applied"] + [
            f"- {x}" for x in hub.board["fixes"]] + ["", f"## Verification: {'PASSED' if hub.board['verification']['passed'] else 'ISSUES REMAIN'}"]
        st.sandbox.write("AUDIT_REPORT.md", "\n".join(report) + "\n")
        hub.board["sandbox_files"] = sorted(p.name for p in st.sandbox.root.iterdir())
