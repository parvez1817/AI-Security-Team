import uuid
from dataclasses import dataclass
from pathlib import Path

from app.events.event_bus import hub


@dataclass
class Mission:
    id: str
    filename: str
    code: str
    status: str = "created"  # created|running|waiting_approval|rejected|completed|failed
    error: str | None = None
    started: float | None = None
    ended: float | None = None


def create(filename: str, code: str) -> Mission:
    name = Path(filename or "app.py").name or "app.py"
    m = Mission(uuid.uuid4().hex[:8], name, code)
    hub.reset(m)
    return m
