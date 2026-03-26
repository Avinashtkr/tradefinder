"""
TradeFinder — Screener API
Applies multi-factor filters to live quote cache and returns ranked results.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from pydantic import BaseModel
from app.core.deps import get_current_user, get_market_service
from app.services.market_data import MarketDataService, SECTOR_MAP

router = APIRouter()


# ── Filter Schema ─────────────────────────────────────────────────────────────

class ScreenerFilter(BaseModel):
    # Sector
    sectors: Optional[List[str]] = None

    # Price
    min_price: Optional[float] = None
    max_price: Optional[float] = None

    # Volume
    min_volume_ratio: Optional[float] = None   # e.g. 2.0 = 2x avg

    # Price action
    min_change_pct: Optional[float] = None
    max_change_pct: Optional[float] = None
    above_vwap: Optional[bool] = None

    # Signals
    signal_types: Optional[List[str]] = None

    # OI
    min_oi_change_pct: Optional[float] = None

    # RS
    min_rs: Optional[float] = None     # relative strength vs Nifty

    # Sorting
    sort_by: str = "change_pct"        # change_pct|volume|ltp|rs
    sort_dir: str = "desc"             # asc|desc

    # Pagination
    limit: int = 50
    offset: int = 0


class ScreenerResult(BaseModel):
    symbol: str
    exchange: str
    sector: str
    ltp: float
    change_pct: float
    volume: float
    oi: float
    vwap: float
    pcr: float
    signal_type: Optional[str]
    signal_label: Optional[str]
    confidence: Optional[float]
    rank: int


@router.post("/run", response_model=List[ScreenerResult])
async def run_screener(
    filters: ScreenerFilter,
    user=Depends(get_current_user),
    market: MarketDataService = Depends(get_market_service),
):
    quotes = await market.get_all_quotes()

    # ── Apply filters ─────────────────────────────────────────────────────────
    results = []
    for q in quotes:
        # Sector filter
        sector = SECTOR_MAP.get(q["symbol"], "Other")
        if filters.sectors and sector not in filters.sectors:
            continue

        # Price filter
        ltp = q.get("ltp", 0)
        if filters.min_price and ltp < filters.min_price:
            continue
        if filters.max_price and ltp > filters.max_price:
            continue

        # Volume filter (volume_ratio = current / avg_20d; approximate here)
        volume = q.get("volume", 0)
        if filters.min_volume_ratio:
            # Without historical avg, skip symbols with too-low volume
            if volume < 100_000:   # minimum liquidity gate
                continue

        # Price action
        chg = q.get("change_pct", 0)
        if filters.min_change_pct is not None and chg < filters.min_change_pct:
            continue
        if filters.max_change_pct is not None and chg > filters.max_change_pct:
            continue

        # VWAP filter
        vwap = q.get("vwap", 0)
        if filters.above_vwap is True and ltp <= vwap:
            continue
        if filters.above_vwap is False and ltp >= vwap:
            continue

        results.append({**q, "sector": sector})

    # ── Sort ──────────────────────────────────────────────────────────────────
    reverse = filters.sort_dir == "desc"
    sort_key = filters.sort_by if filters.sort_by in ("ltp", "volume", "change_pct", "oi") else "change_pct"
    results.sort(key=lambda x: x.get(sort_key, 0), reverse=reverse)

    # ── Paginate + rank ───────────────────────────────────────────────────────
    paginated = results[filters.offset: filters.offset + filters.limit]
    return [
        ScreenerResult(
            symbol=r["symbol"],
            exchange=r.get("exchange", "NSE"),
            sector=r.get("sector", "Other"),
            ltp=r.get("ltp", 0),
            change_pct=r.get("change_pct", 0),
            volume=r.get("volume", 0),
            oi=r.get("oi", 0),
            vwap=r.get("vwap", 0),
            pcr=r.get("pcr", 0),
            signal_type=r.get("signal_type"),
            signal_label=r.get("signal_label"),
            confidence=r.get("confidence"),
            rank=filters.offset + i + 1,
        )
        for i, r in enumerate(paginated)
    ]


@router.get("/presets")
async def get_presets():
    """Pre-built screener presets."""
    return [
        {
            "id": "orb_breakout",
            "name": "ORB Breakouts (9:20-9:25)",
            "description": "Opening range breakout with volume surge",
            "filters": {
                "signal_types": ["bullish_breakout"],
                "min_volume_ratio": 2.0,
                "sort_by": "confidence",
            },
            "tier": "free",
        },
        {
            "id": "volume_surge",
            "name": "Volume Surge Stocks",
            "description": "Unusual volume activity (>2.5x average)",
            "filters": {
                "min_volume_ratio": 2.5,
                "sort_by": "volume",
            },
            "tier": "free",
        },
        {
            "id": "strongest_stocks",
            "name": "Strongest Stocks",
            "description": "Highest relative strength vs Nifty 50",
            "filters": {
                "min_change_pct": 0.5,
                "above_vwap": True,
                "sort_by": "change_pct",
            },
            "tier": "basic",
        },
        {
            "id": "weakest_stocks",
            "name": "Weakest Stocks",
            "description": "Most bearish stocks for short trades",
            "filters": {
                "max_change_pct": -0.5,
                "above_vwap": False,
                "sort_by": "change_pct",
                "sort_dir": "asc",
            },
            "tier": "basic",
        },
        {
            "id": "oi_buildup",
            "name": "OI Long Buildup",
            "description": "F&O stocks with rising OI + price",
            "filters": {
                "signal_types": ["oi_buildup_long"],
                "min_oi_change_pct": 5.0,
                "sort_by": "oi",
            },
            "tier": "premium",
        },
        {
            "id": "momentum_leaders",
            "name": "Momentum Leaders",
            "description": "RSI breakout + VWAP reclaim combo",
            "filters": {
                "signal_types": ["rsi_breakout", "vwap_reclaim"],
                "above_vwap": True,
                "sort_by": "change_pct",
            },
            "tier": "premium",
        },
    ]
