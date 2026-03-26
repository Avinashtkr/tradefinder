"""
TradeFinder — Application configuration (pydantic-settings v2)
"""
from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List
import secrets


class Settings(BaseSettings):
    # ── App ──────────────────────────────────────────────────────────────────
    APP_NAME: str = "TradeFinder"
    ENVIRONMENT: str = "development"
    SECRET_KEY: str = secrets.token_urlsafe(32)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8   # 8 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/tradefinder"
    TIMESCALE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/tradefinder_ts"

    # ── Redis ─────────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_CHANNEL_TICKS: str = "ticks"
    REDIS_CHANNEL_SIGNALS: str = "signals"

    # ── Market data providers ─────────────────────────────────────────────────
    KITE_API_KEY: str = ""
    KITE_API_SECRET: str = ""
    KITE_ACCESS_TOKEN: str = ""

    UPSTOX_API_KEY: str = ""
    UPSTOX_SECRET: str = ""

    YAHOO_FINANCE_ENABLED: bool = True   # fallback / dev mode

    # ── AWS ───────────────────────────────────────────────────────────────────
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_S3_BUCKET: str = "tradefinder-backtest-results"
    AWS_REGION: str = "ap-south-1"

    # ── CORS ──────────────────────────────────────────────────────────────────
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "https://tradefinder.in",
        "https://www.tradefinder.in",
    ]

    # ── Subscription tiers ────────────────────────────────────────────────────
    FREE_SCAN_LIMIT: int = 5
    BASIC_SCAN_LIMIT: int = 50
    PREMIUM_SCAN_LIMIT: int = 9999

    # ── Trading calendar ──────────────────────────────────────────────────────
    MARKET_OPEN_IST: str = "09:15"
    MARKET_CLOSE_IST: str = "15:30"
    TIMEZONE: str = "Asia/Kolkata"

    # ── Strategy engine ───────────────────────────────────────────────────────
    TICK_INTERVAL_SECONDS: int = 3
    SIGNAL_LOOKBACK_BARS: int = 20
    MOMENTUM_THRESHOLD: float = 0.5    # % price move
    VOLUME_SURGE_MULTIPLIER: float = 2.0
    RSI_OVERBOUGHT: float = 70.0
    RSI_OVERSOLD: float = 30.0

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
