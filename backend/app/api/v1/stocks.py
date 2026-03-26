"""
TradeFinder — Stocks API (quotes, OHLCV, sector data)
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from app.core.deps import get_current_user, get_market_service
from app.services.market_data import MarketDataService, NSE_UNIVERSE, SECTOR_MAP

router = APIRouter()


@router.get("/quotes")
async def get_all_quotes(
    market: MarketDataService = Depends(get_market_service),
    user=Depends(get_current_user),
):
    """Return all cached live quotes."""
    return await market.get_all_quotes()


@router.get("/quote/{symbol}")
async def get_quote(
    symbol: str,
    market: MarketDataService = Depends(get_market_service),
    user=Depends(get_current_user),
):
    quote = await market.get_cached_quote(symbol.upper())
    if not quote:
        raise HTTPException(status_code=404, detail=f"No live quote for {symbol}")
    return quote


@router.get("/universe")
async def get_universe(user=Depends(get_current_user)):
    """Return full NSE universe with sector mapping."""
    return [
        {"symbol": sym, "sector": SECTOR_MAP.get(sym, "Other"), "exchange": "NSE"}
        for sym in NSE_UNIVERSE
    ]


@router.get("/sectors")
async def get_sectors(
    market: MarketDataService = Depends(get_market_service),
    user=Depends(get_current_user),
):
    """Aggregate sector performance from live quotes."""
    quotes = await market.get_all_quotes()
    sectors = {}
    for q in quotes:
        sector = q.get("sector") or SECTOR_MAP.get(q["symbol"], "Other")
        if sector not in sectors:
            sectors[sector] = {"stocks": [], "total_change": 0, "count": 0}
        sectors[sector]["stocks"].append(q["symbol"])
        sectors[sector]["total_change"] += q.get("change_pct", 0)
        sectors[sector]["count"] += 1

    return [
        {
            "sector": sector,
            "avg_change": round(data["total_change"] / data["count"], 2),
            "stock_count": data["count"],
            "stocks": data["stocks"],
        }
        for sector, data in sorted(sectors.items(), key=lambda x: x[1]["total_change"] / max(x[1]["count"], 1), reverse=True)
    ]


@router.get("/top-gainers")
async def top_gainers(
    limit: int = Query(10, le=50),
    market: MarketDataService = Depends(get_market_service),
    user=Depends(get_current_user),
):
    quotes = await market.get_all_quotes()
    sorted_quotes = sorted(quotes, key=lambda q: q.get("change_pct", 0), reverse=True)
    return sorted_quotes[:limit]


@router.get("/top-losers")
async def top_losers(
    limit: int = Query(10, le=50),
    market: MarketDataService = Depends(get_market_service),
    user=Depends(get_current_user),
):
    quotes = await market.get_all_quotes()
    sorted_quotes = sorted(quotes, key=lambda q: q.get("change_pct", 0))
    return sorted_quotes[:limit]


@router.get("/52week/{symbol}")
async def week52(symbol: str, user=Depends(get_current_user)):
    """
    Placeholder: in production, query TimescaleDB for 52-week high/low.
    """
    return {"symbol": symbol, "high_52w": None, "low_52w": None, "message": "TimescaleDB query required"}
