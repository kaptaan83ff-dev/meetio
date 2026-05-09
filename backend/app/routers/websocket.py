from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.websocket.connection_manager import manager

router = APIRouter(prefix="/ws", tags=["WebSocket"])

@router.websocket("/{meeting_id}")
async def websocket_endpoint(websocket: WebSocket, meeting_id: str):
    await manager.connect(websocket, meeting_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Simple echo for the stub implementation
            await manager.broadcast(f"Echo: {data}", meeting_id)
    except WebSocketDisconnect:
        manager.disconnect(websocket, meeting_id)
        await manager.broadcast("A user has left the meeting.", meeting_id)
