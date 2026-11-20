from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.events.event_bus import hub
from app.missions import mission_manager
from app.missions.mission_executor import start
import asyncio

router = APIRouter()


class SourceIn(BaseModel):
    filename: str = "app.py"
    code: str


@router.get("/samples/default")
def default_sample():
    p = settings.samples_dir / "vulnerable_app.py"
    return {"filename": p.name, "code": p.read_text()}


@router.post("/missions")
def create(body: SourceIn):
    if not body.code.strip():
        raise HTTPException(400, "Source code is empty")
    if hub.mission and hub.mission.status in ("running", "waiting_approval"):
        raise HTTPException(409, "A mission is already in progress")
    m = mission_manager.create(body.filename, body.code)
    return {"id": m.id, "filename": m.filename}


@router.post("/missions/{mission_id}/run")
async def run(mission_id: str):
    m = hub.mission
    if not m or m.id != mission_id:
        raise HTTPException(404, "Mission not found")
    if m.status != "created":
        raise HTTPException(409, f"Mission is {m.status}")
    start(m)
    return {"status": "started"}
