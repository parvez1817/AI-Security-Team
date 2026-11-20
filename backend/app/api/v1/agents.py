from fastapi import APIRouter

from app.events.event_bus import ROSTER

router = APIRouter()


@router.get("/agents")
def agents():
    return ROSTER
