"""
TradeFinder — FastAPI entry point
"""
from contextlib import asynccontextmanager
import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.core.config import settings
from app.core.redis_client import redis_client
from app.db.session import engine, Base
from app.api.v1 import auth, stocks, screener, signals, backtest, alerts
from app.websockets.manager import ws_manager
from app.services.market_data import MarketDataService
from app.services.signal_broadcaster import SignalBroadcaster


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────────────────────
    await redis_client.connect()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    market_svc = MarketDataService()
    broadcaster = SignalBroadcaster(ws_manager, redis_client)

    # Background tasks: tick ingest + signal broadcasting
    asyncio.create_task(market_svc.start_feed())
    asyncio.create_task(broadcaster.run())

    app.state.market_svc = market_svc
    yield

    # ── Shutdown ─────────────────────────────────────────────────────────────
    await market_svc.stop()
    await redis_client.disconnect()


app = FastAPI(
    title="TradeFinder API",
    version="1.0.0",
    description="Real-time Indian stock market scanner",
    lifespan=lifespan,
)

# ── Middleware ────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=500)

# ── Routers ───────────────────────────────────────────────────────────────────
PREFIX = "/api/v1"
app.include_router(auth.router,      prefix=PREFIX + "/auth",     tags=["auth"])
app.include_router(stocks.router,    prefix=PREFIX + "/stocks",   tags=["stocks"])
app.include_router(screener.router,  prefix=PREFIX + "/screener", tags=["screener"])
app.include_router(signals.router,   prefix=PREFIX + "/signals",  tags=["signals"])
app.include_router(backtest.router,  prefix=PREFIX + "/backtest", tags=["backtest"])
app.include_router(alerts.router,    prefix=PREFIX + "/alerts",   tags=["alerts"])

# WebSocket endpoint lives at /ws
from app.websockets.routes import ws_router
app.include_router(ws_router)


@app.get("/health")
async def health():
    return {"status": "ok", "redis": await redis_client.ping()}
