from fastapi import APIRouter

from app.events.event_bus import hub

router = APIRouter()


@router.get("/dashboard")
def dashboard():
    return hub.snapshot()
