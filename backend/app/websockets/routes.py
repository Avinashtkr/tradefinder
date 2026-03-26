"""
TradeFinder — WebSocket Routes
"""
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.websockets.manager import ws_manager
from app.core.security import decode_access_token

ws_router = APIRouter()


@ws_router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(None),
):
    """
    Main WebSocket endpoint.
    Client connects with: ws://host/ws?token=<jwt>
    Messages received:
      {"action": "subscribe", "channel": "broadcast|user|watchlist:<id>"}
      {"action": "ping"}
    """
    # Validate token
    user_id = None
    if token:
        payload = decode_access_token(token)
        if payload:
            user_id = payload.get("sub")

    await ws_manager.connect(websocket, room="broadcast")

    # If authenticated, also join user-specific room
    if user_id:
        await ws_manager.subscribe(websocket, f"user:{user_id}")

    try:
        await websocket.send_json({
            "type": "connected",
            "data": {
                "authenticated": bool(user_id),
                "user_id": user_id,
                "message": "Connected to TradeFinder live feed",
            }
        })

        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except Exception:
                continue

            action = msg.get("action")

            if action == "ping":
                await websocket.send_json({"type": "pong"})

            elif action == "subscribe":
                channel = msg.get("channel", "")
                if channel.startswith("watchlist:") and user_id:
                    await ws_manager.subscribe(websocket, f"{channel}:{user_id}")
                    await websocket.send_json({
                        "type": "subscribed",
                        "channel": channel,
                    })

            elif action == "filter":
                # Client can request server-side filtered stream
                # Store filter preferences (basic demo)
                await websocket.send_json({
                    "type": "filter_applied",
                    "filters": msg.get("filters", {}),
                })

    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        ws_manager.disconnect(websocket)
