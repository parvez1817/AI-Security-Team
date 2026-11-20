from fastapi import APIRouter

from app.events.event_bus import hub

router = APIRouter()


@router.get("/events")
def events():
    return list(hub.events)
