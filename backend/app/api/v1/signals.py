"""
TradeFinder — Signals & Alerts API
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta

from app.db.session import get_db
from app.models.models import Signal, Alert
from app.core.deps import get_current_user

router = APIRouter()


@router.get("/recent")
async def recent_signals(
    limit: int = Query(50, le=200),
    symbol: Optional[str] = None,
    signal_type: Optional[str] = None,
    since_minutes: int = Query(60, description="Look back N minutes"),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    since = datetime.utcnow() - timedelta(minutes=since_minutes)
    q = select(Signal).where(Signal.generated_at >= since, Signal.is_active == True)
    if symbol:
        q = q.where(Signal.symbol == symbol.upper())
    if signal_type:
        q = q.where(Signal.signal_type == signal_type)
    q = q.order_by(desc(Signal.generated_at)).limit(limit)

    result = await db.execute(q)
    signals = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "symbol": s.symbol,
            "exchange": s.exchange,
            "signal_type": s.signal_type,
            "confidence": s.confidence,
            "trigger_price": s.trigger_price,
            "target_price": s.target_price,
            "stop_loss": s.stop_loss,
            "metadata": s.metadata,
            "generated_at": s.generated_at.isoformat(),
        }
        for s in signals
    ]


@router.get("/stats")
async def signal_stats(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Signal counts by type for the current trading session."""
    today_start = datetime.utcnow().replace(hour=3, minute=45)   # 9:15 IST = 03:45 UTC
    result = await db.execute(
        select(Signal).where(Signal.generated_at >= today_start)
    )
    signals = result.scalars().all()
    counts = {}
    for s in signals:
        counts[s.signal_type] = counts.get(s.signal_type, 0) + 1
    return {"session_start": today_start.isoformat(), "counts": counts, "total": len(signals)}


# ── Alerts ─────────────────────────────────────────────────────────────────────

class AlertCreate(BaseModel):
    symbol: str
    condition: dict    # {"field": "ltp", "op": ">=", "value": 2500}
    notification_channels: List[str] = ["push"]


@router.post("/alerts", status_code=201)
async def create_alert(
    body: AlertCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    alert = Alert(
        user_id=str(user.id),
        symbol=body.symbol.upper(),
        condition=body.condition,
        notification_channels=body.notification_channels,
    )
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    return {"id": str(alert.id), "symbol": alert.symbol, "status": "active"}


@router.get("/alerts")
async def list_alerts(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    result = await db.execute(
        select(Alert).where(Alert.user_id == str(user.id), Alert.is_active == True)
    )
    alerts = result.scalars().all()
    return [
        {
            "id": str(a.id),
            "symbol": a.symbol,
            "condition": a.condition,
            "channels": a.notification_channels,
            "triggered_at": a.triggered_at.isoformat() if a.triggered_at else None,
        }
        for a in alerts
    ]


@router.delete("/alerts/{alert_id}")
async def delete_alert(
    alert_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    result = await db.execute(
        select(Alert).where(Alert.id == alert_id, Alert.user_id == str(user.id))
    )
    alert = result.scalars().first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_active = False
    await db.commit()
    return {"status": "deleted"}
