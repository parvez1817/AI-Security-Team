from fastapi import APIRouter

from app.api.v1 import agents, approvals, dashboard, events, health, missions

api_router = APIRouter()
for m in (health, missions, approvals, dashboard, agents, events):
    api_router.include_router(m.router)
