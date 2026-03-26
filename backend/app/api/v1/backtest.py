"""
TradeFinder — Backtest API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

from app.db.session import get_db
from app.models.models import BacktestRun, OHLCV
from app.core.deps import get_current_user
from app.services.backtest_engine import BacktestEngine, Bar

router = APIRouter()


class BacktestRequest(BaseModel):
    strategy_name: str
    universe: List[str]
    start_date: str      # ISO date string
    end_date: str
    parameters: dict = {}


class BacktestResponse(BaseModel):
    id: str
    status: str
    strategy: str
    total_trades: int
    win_rate: float
    net_pnl: float
    max_drawdown: float
    sharpe_ratio: float
    avg_win: float
    avg_loss: float
    risk_reward: float
    trades: list
    equity_curve: list


@router.post("/run", response_model=BacktestResponse)
async def run_backtest(
    body: BacktestRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    if user.subscription_tier == "free":
        raise HTTPException(status_code=403, detail="Backtest requires Basic or Premium subscription")

    # Fetch historical OHLCV from DB
    start = datetime.fromisoformat(body.start_date)
    end   = datetime.fromisoformat(body.end_date)

    bars_by_symbol = {}
    for symbol in body.universe[:20]:   # cap universe size
        result = await db.execute(
            select(OHLCV).where(
                OHLCV.symbol == symbol,
                OHLCV.interval == "1d",
                OHLCV.timestamp >= start,
                OHLCV.timestamp <= end,
            ).order_by(OHLCV.timestamp)
        )
        rows = result.scalars().all()
        if rows:
            bars_by_symbol[symbol] = [
                Bar(
                    timestamp=r.timestamp,
                    open=r.open, high=r.high, low=r.low,
                    close=r.close, volume=r.volume, oi=r.oi or 0,
                )
                for r in rows
            ]

    if not bars_by_symbol:
        # Demo mode: generate synthetic bars if no DB data
        bars_by_symbol = _generate_demo_bars(body.universe[:5], start, end)

    engine = BacktestEngine(
        strategy=body.strategy_name,
        capital=body.parameters.get("capital", 1_000_000),
        risk_per_trade=body.parameters.get("risk_per_trade", 0.01),
    )

    bt_result = engine.run(bars_by_symbol)

    # Persist run to DB
    run = BacktestRun(
        user_id=str(user.id),
        strategy_name=body.strategy_name,
        parameters=body.parameters,
        universe=body.universe,
        start_date=start,
        end_date=end,
        total_trades=bt_result.total_trades,
        win_rate=bt_result.win_rate,
        net_pnl=bt_result.net_pnl,
        max_drawdown=bt_result.max_drawdown,
        sharpe_ratio=bt_result.sharpe_ratio,
        status="done",
        completed_at=datetime.utcnow(),
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    return BacktestResponse(
        id=str(run.id),
        status="done",
        strategy=bt_result.strategy,
        total_trades=bt_result.total_trades,
        win_rate=bt_result.win_rate,
        net_pnl=bt_result.net_pnl,
        max_drawdown=bt_result.max_drawdown,
        sharpe_ratio=bt_result.sharpe_ratio,
        avg_win=bt_result.avg_win,
        avg_loss=bt_result.avg_loss,
        risk_reward=bt_result.risk_reward,
        trades=[
            {
                "symbol": t.symbol,
                "direction": t.direction,
                "signal_type": t.signal_type,
                "entry_price": t.entry_price,
                "exit_price": t.exit_price,
                "quantity": t.quantity,
                "pnl": t.pnl,
                "pnl_pct": t.pnl_pct,
                "exit_reason": t.exit_reason,
                "bars_held": t.bars_held,
            }
            for t in bt_result.trades
        ],
        equity_curve=bt_result.equity_curve,
    )


@router.get("/history")
async def backtest_history(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    result = await db.execute(
        select(BacktestRun)
        .where(BacktestRun.user_id == str(user.id))
        .order_by(BacktestRun.started_at.desc())
        .limit(20)
    )
    runs = result.scalars().all()
    return [
        {
            "id": str(r.id),
            "strategy_name": r.strategy_name,
            "universe": r.universe,
            "total_trades": r.total_trades,
            "win_rate": r.win_rate,
            "net_pnl": r.net_pnl,
            "sharpe_ratio": r.sharpe_ratio,
            "status": r.status,
            "started_at": r.started_at.isoformat(),
        }
        for r in runs
    ]


def _generate_demo_bars(symbols, start, end):
    """Generate synthetic OHLCV bars for demo mode when no DB data exists."""
    import random
    from datetime import timedelta

    bars_by_symbol = {}
    base_prices = {"RELIANCE": 2800, "TCS": 3900, "HDFCBANK": 1700, "INFY": 1900, "ICICIBANK": 1200}

    for sym in symbols:
        bars = []
        price = base_prices.get(sym, 1500)
        current = start
        while current <= end:
            if current.weekday() < 5:   # skip weekends
                pct = random.gauss(0.0005, 0.015)
                close = price * (1 + pct)
                high  = max(price, close) * (1 + abs(random.gauss(0, 0.005)))
                low   = min(price, close) * (1 - abs(random.gauss(0, 0.005)))
                bars.append(Bar(
                    timestamp=current,
                    open=round(price, 2),
                    high=round(high, 2),
                    low=round(low, 2),
                    close=round(close, 2),
                    volume=random.randint(500_000, 5_000_000),
                    oi=random.randint(100_000, 1_000_000),
                ))
                price = close
            current += timedelta(days=1)
        if bars:
            bars_by_symbol[sym] = bars

    return bars_by_symbol
