"""
TradeFinder — SQLAlchemy ORM models
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    Column, String, Float, Integer, Boolean,
    DateTime, ForeignKey, Text, Enum, JSON, Index
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
import enum

from app.db.session import Base


def gen_uuid():
    return str(uuid.uuid4())


# ── Enums ─────────────────────────────────────────────────────────────────────

class SubscriptionTier(str, enum.Enum):
    FREE = "free"
    BASIC = "basic"
    PREMIUM = "premium"

class SignalType(str, enum.Enum):
    BULLISH_BREAKOUT = "bullish_breakout"
    BEARISH_BREAKDOWN = "bearish_breakdown"
    HIGH_MOMENTUM = "high_momentum"
    VOLUME_SURGE = "volume_surge"
    VWAP_RECLAIM = "vwap_reclaim"
    VWAP_REJECT = "vwap_reject"
    OI_BUILDUP_LONG = "oi_buildup_long"
    OI_BUILDUP_SHORT = "oi_buildup_short"
    RSI_BREAKOUT = "rsi_breakout"
    SECTOR_LEADER = "sector_leader"

class Exchange(str, enum.Enum):
    NSE = "NSE"
    BSE = "BSE"
    NFO = "NFO"   # F&O


# ── Users & Auth ──────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(UUID, primary_key=True, default=gen_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255))
    phone = Column(String(20))
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    subscription_tier = Column(Enum(SubscriptionTier), default=SubscriptionTier.FREE)
    subscription_expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    watchlists = relationship("Watchlist", back_populates="user", cascade="all, delete")
    alerts = relationship("Alert", back_populates="user", cascade="all, delete")
    backtest_runs = relationship("BacktestRun", back_populates="user", cascade="all, delete")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(UUID, primary_key=True, default=gen_uuid)
    user_id = Column(UUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(255), nullable=False, unique=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


# ── Stocks ────────────────────────────────────────────────────────────────────

class Stock(Base):
    __tablename__ = "stocks"

    id = Column(UUID, primary_key=True, default=gen_uuid)
    symbol = Column(String(30), nullable=False)
    exchange = Column(Enum(Exchange), nullable=False)
    name = Column(String(255))
    sector = Column(String(100), index=True)
    industry = Column(String(100))
    market_cap = Column(Float)
    lot_size = Column(Integer, default=1)
    is_fno = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    isin = Column(String(20), unique=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_stocks_symbol_exchange", "symbol", "exchange", unique=True),
    )


# ── Live Quotes (stored in Redis; persisted here for replay) ──────────────────

class Quote(Base):
    __tablename__ = "quotes"

    id = Column(UUID, primary_key=True, default=gen_uuid)
    stock_id = Column(UUID, ForeignKey("stocks.id"), nullable=False, index=True)
    symbol = Column(String(30), nullable=False)
    timestamp = Column(DateTime, nullable=False, index=True)

    ltp = Column(Float)           # last traded price
    open = Column(Float)
    high = Column(Float)
    low = Column(Float)
    close = Column(Float)
    volume = Column(Float)
    oi = Column(Float)            # open interest
    vwap = Column(Float)
    pcr = Column(Float)           # put-call ratio
    change_pct = Column(Float)
    avg_volume_20d = Column(Float)
    relative_strength = Column(Float)   # RS vs Nifty 50

    __table_args__ = (
        Index("ix_quotes_symbol_ts", "symbol", "timestamp"),
    )


# ── OHLCV Bars (TimescaleDB hypertable in production) ─────────────────────────

class OHLCV(Base):
    __tablename__ = "ohlcv"

    id = Column(UUID, primary_key=True, default=gen_uuid)
    symbol = Column(String(30), nullable=False)
    exchange = Column(String(5), nullable=False)
    interval = Column(String(5), nullable=False)   # 1m, 5m, 15m, 1d
    timestamp = Column(DateTime, nullable=False)
    open = Column(Float)
    high = Column(Float)
    low = Column(Float)
    close = Column(Float)
    volume = Column(Float)
    oi = Column(Float, nullable=True)

    __table_args__ = (
        Index("ix_ohlcv_sym_interval_ts", "symbol", "interval", "timestamp"),
    )


# ── Signals ───────────────────────────────────────────────────────────────────

class Signal(Base):
    __tablename__ = "signals"

    id = Column(UUID, primary_key=True, default=gen_uuid)
    symbol = Column(String(30), nullable=False, index=True)
    exchange = Column(String(5), nullable=False)
    signal_type = Column(Enum(SignalType), nullable=False)
    confidence = Column(Float, nullable=False)      # 0.0 – 1.0
    trigger_price = Column(Float)
    target_price = Column(Float)
    stop_loss = Column(Float)
    metadata = Column(JSON)                          # extra context
    generated_at = Column(DateTime, default=datetime.utcnow, index=True)
    expires_at = Column(DateTime)
    is_active = Column(Boolean, default=True)

    __table_args__ = (
        Index("ix_signals_sym_ts", "symbol", "generated_at"),
    )


# ── Watchlists ────────────────────────────────────────────────────────────────

class Watchlist(Base):
    __tablename__ = "watchlists"

    id = Column(UUID, primary_key=True, default=gen_uuid)
    user_id = Column(UUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    symbols = Column(JSON, default=list)   # ["RELIANCE", "TCS", ...]
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="watchlists")


# ── Alerts ────────────────────────────────────────────────────────────────────

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(UUID, primary_key=True, default=gen_uuid)
    user_id = Column(UUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    symbol = Column(String(30), nullable=False)
    condition = Column(JSON)   # {"field": "ltp", "op": ">=", "value": 2500}
    notification_channels = Column(JSON)   # ["email", "push", "telegram"]
    is_active = Column(Boolean, default=True)
    triggered_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="alerts")


# ── Backtest ──────────────────────────────────────────────────────────────────

class BacktestRun(Base):
    __tablename__ = "backtest_runs"

    id = Column(UUID, primary_key=True, default=gen_uuid)
    user_id = Column(UUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    strategy_name = Column(String(100), nullable=False)
    parameters = Column(JSON)
    universe = Column(JSON)           # list of symbols tested
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    total_trades = Column(Integer)
    win_rate = Column(Float)
    net_pnl = Column(Float)
    max_drawdown = Column(Float)
    sharpe_ratio = Column(Float)
    results_s3_key = Column(String(500))   # S3 path to full CSV
    status = Column(String(30), default="pending")  # pending|running|done|failed
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="backtest_runs")
