"""Single in-memory hub: agent states, last 30 events, board data, subscribers."""
import asyncio
import time
from collections import deque

from app.config import settings

ROSTER = [
    {"id": "manager", "name": "Manager / Orchestrator", "short": "Manager"},
    {"id": "risk", "name": "Risk Assessor", "short": "Risk"},
    {"id": "sast", "name": "SAST Code Reviewer", "short": "SAST"},
    {"id": "pentest", "name": "Pentester & DAST", "short": "Pentest"},
    {"id": "implementer", "name": "Security Implementer", "short": "Implementer"},
    {"id": "crypto", "name": "Crypto & Data Security", "short": "Crypto"},
]
NAMES = {a["id"]: a["name"] for a in ROSTER}


def _board():
    return {
        "stage": "idle", "overview": {}, "routes": [], "findings": [], "plan": [],
        "threat_model": "", "probes": [], "deps": [], "fixes": [], "sandbox_files": [],
        "diff": "", "verification": None, "screens": {},
        "counts": {"handoffs": 0, "rejects": 0, "findings": 0, "critical": 0, "high": 0, "medium": 0, "low": 0},
    }


class Hub:
    def __init__(self):
        self.subs: set[asyncio.Queue] = set()
        self.reset()

    def reset(self, mission=None):
        self.mission = mission
        self.agents = {a["id"]: {"state": "idle", "message": "Idle"} for a in ROSTER}
        self.events: deque = deque(maxlen=30)
        self._eid = 0
        self.board = _board()
        self.publish()

    def emit(self, agent, state, message, to=None):
        self._eid += 1
        self.agents[agent] = {"state": state, "message": message}
        self.events.append({"id": self._eid, "time": time.strftime("%H:%M:%S"), "agent": agent,
                            "state": state, "message": message, "toAgent": to})
        if to and state in ("handoff", "rejected"):
            self.board["counts"]["handoffs"] += 1
            self.board["counts"]["rejects"] += state == "rejected"
        self.publish()

    def screen(self, agent, lines):
        self.board["screens"][agent] = [{"t": t, "k": k} for t, k in lines]
        self.publish()

    def set_findings(self, findings):
        order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        self.board["findings"] = sorted(findings, key=lambda f: (order[f["severity"]], f["line"]))
        c = self.board["counts"]
        c["findings"] = len(findings)
        for s in order:
            c[s] = sum(f["severity"] == s for f in findings)
        self.publish()

    def snapshot(self):
        m = self.mission
        return {
            "mission": m and {"id": m.id, "filename": m.filename, "status": m.status, "error": m.error,
                              "started": m.started, "ended": m.ended},
            "agents": self.agents, "events": list(self.events), "board": self.board,
            "llm_ready": bool(settings.api_key),
        }

    def subscribe(self):
        q: asyncio.Queue = asyncio.Queue()
        self.subs.add(q)
        return q

    def unsubscribe(self, q):
        self.subs.discard(q)

    def publish(self):
        if self.subs:
            snap = self.snapshot()
            for q in self.subs:
                q.put_nowait(snap)


hub = Hub()
