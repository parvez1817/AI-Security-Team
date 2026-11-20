from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.events.event_bus import hub

router = APIRouter()


@router.websocket("/ws/dashboard")
async def dashboard_ws(ws: WebSocket):
    await ws.accept()
    q = hub.subscribe()
    try:
        await ws.send_json(hub.snapshot())
        while True:
            await ws.send_json(await q.get())
    except WebSocketDisconnect:
        pass
    finally:
        hub.unsubscribe(q)
