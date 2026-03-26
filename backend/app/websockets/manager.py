"""
TradeFinder — WebSocket Connection Manager + Signal Broadcaster
"""
from __future__ import annotations
import asyncio
import json
import logging
from collections import defaultdict
from typing import Dict, Set, Optional

from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


class WebSocketManager:
    """
    Manages all active WebSocket connections.
    Supports rooms (per-user, per-watchlist, broadcast).
    """

    def __init__(self):
        # room_id → set of WebSocket connections
        self._rooms: Dict[str, Set[WebSocket]] = defaultdict(set)
        # ws → set of rooms it's subscribed to
        self._ws_rooms: Dict[WebSocket, Set[str]] = defaultdict(set)

    async def connect(self, ws: WebSocket, room: str = "broadcast"):
        await ws.accept()
        self._rooms[room].add(ws)
        self._ws_rooms[ws].add(room)
        logger.info(f"WS connected → room={room} total={len(self._rooms[room])}")

    def disconnect(self, ws: WebSocket):
        for room in self._ws_rooms.pop(ws, set()):
            self._rooms[room].discard(ws)
            if not self._rooms[room]:
                del self._rooms[room]
        logger.info("WS disconnected")

    async def subscribe(self, ws: WebSocket, room: str):
        self._rooms[room].add(ws)
        self._ws_rooms[ws].add(room)

    async def send_personal(self, ws: WebSocket, data: dict):
        try:
            await ws.send_json(data)
        except Exception:
            self.disconnect(ws)

    async def broadcast_room(self, room: str, data: dict):
        dead: Set[WebSocket] = set()
        msg = json.dumps(data)
        for ws in list(self._rooms.get(room, set())):
            try:
                await ws.send_text(msg)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.disconnect(ws)

    async def broadcast_all(self, data: dict):
        await self.broadcast_room("broadcast", data)

    def connection_count(self) -> int:
        return len(self._ws_rooms)


ws_manager = WebSocketManager()


class SignalBroadcaster:
    """
    Subscribes to Redis pub/sub channels and fans out to WebSocket clients.
    Also runs the strategy engine on each tick.
    """

    def __init__(self, manager: WebSocketManager, redis_client):
        self.manager = manager
        self.redis = redis_client
        self._running = False

    async def run(self):
        from app.core.config import settings
        from app.strategies.engine import SignalGenerator, Bar, Quote

        self._running = True
        generator = SignalGenerator()

        # Buffer of bars per symbol for strategy engine
        bars_cache: Dict[str, list] = {}
        prev_oi: Dict[str, float] = {}

        logger.info("Signal broadcaster started")

        try:
            pubsub = await self.redis.subscribe(settings.REDIS_CHANNEL_TICKS)
            async for message in pubsub:
                if not self._running:
                    break
                try:
                    payload = json.loads(message)
                except Exception:
                    continue

                symbol = payload.get("symbol", "")
                if not symbol:
                    continue

                # Broadcast live tick to all connected clients
                await self.manager.broadcast_all({
                    "type": "tick",
                    "data": payload,
                })

                # Run signal generation every 5 seconds per symbol
                # (in production, use a proper scheduler)
                bars = bars_cache.get(symbol, [])
                if len(bars) > 0 and bars[-1].get("ts") == payload.get("timestamp", "")[:16]:
                    pass  # same minute, skip re-run
                else:
                    # Reconstruct Bar list from tick data (simplified)
                    bars_cache[symbol] = bars[-100:]   # keep last 100 bars

                    quote = Quote(
                        symbol=symbol,
                        exchange=payload.get("exchange", "NSE"),
                        ltp=payload.get("ltp", 0),
                        open=payload.get("open", 0),
                        high=payload.get("high", 0),
                        low=payload.get("low", 0),
                        prev_close=payload.get("prev_close", 0),
                        volume=payload.get("volume", 0),
                        oi=payload.get("oi", 0),
                    )

                    prev = prev_oi.get(symbol, 0)
                    prev_oi[symbol] = quote.oi

                    signals = generator.generate(
                        symbol=symbol,
                        exchange=quote.exchange,
                        bars=[],    # TODO: inject actual Bar list from OHLCV service
                        quote=quote,
                        avg_volume=quote.volume * 0.5,  # placeholder
                        index_closes=[],
                        prev_oi=prev,
                    )

                    for sig in signals:
                        signal_payload = {
                            "type": "signal",
                            "data": {
                                "symbol": sig.symbol,
                                "exchange": sig.exchange,
                                "signal_type": sig.signal_type,
                                "label": _signal_label(sig.signal_type),
                                "confidence": sig.confidence,
                                "confidence_pct": int(sig.confidence * 100),
                                "trigger_price": sig.trigger_price,
                                "target_price": sig.target_price,
                                "stop_loss": sig.stop_loss,
                                "metadata": sig.metadata,
                                "generated_at": sig.generated_at.isoformat(),
                                "sector": payload.get("sector", ""),
                            },
                        }
                        await self.manager.broadcast_all(signal_payload)

                        # Also publish to signals channel for persistence
                        await self.redis.publish(
                            "signals",
                            json.dumps(signal_payload["data"]),
                        )

        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Broadcaster error: {e}")

    def stop(self):
        self._running = False


def _signal_label(signal_type: str) -> str:
    return {
        "bullish_breakout": "Bullish Breakout",
        "bearish_breakdown": "Bearish Breakdown",
        "volume_surge": "Volume Surge",
        "high_momentum": "High Momentum",
        "oi_buildup_long": "Long Buildup",
        "oi_buildup_short": "Short Buildup",
        "vwap_reclaim": "VWAP Reclaim",
        "vwap_reject": "VWAP Rejection",
        "rsi_breakout": "RSI Breakout",
        "sector_leader": "Sector Leader",
    }.get(signal_type, signal_type.replace("_", " ").title())
