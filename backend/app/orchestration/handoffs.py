import asyncio

from app.config import settings
from app.events.event_bus import NAMES, hub


async def handoff(frm, to, note="", rejected=False):
    hub.emit(frm, "rejected" if rejected else "handoff", note or f"Handing off to {NAMES[to]}", to=to)
    await asyncio.sleep(settings.handoff_pause)
