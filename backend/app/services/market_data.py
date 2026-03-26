"""
TradeFinder — Market Data Service
Connects to Zerodha Kite WebSocket (primary) or Yahoo Finance (fallback/dev).
Normalises ticks → publishes to Redis pub/sub.
"""
from __future__ import annotations
import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional
import aiohttp

from app.core.config import settings
from app.core.redis_client import redis_client
from app.strategies.engine import Bar, Quote, Indicators

logger = logging.getLogger(__name__)

# NSE F&O universe — top 50 stocks by liquidity
NSE_UNIVERSE = [
    "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK",
    "HINDUNILVR", "SBIN", "BHARTIARTL", "ITC", "KOTAKBANK",
    "LT", "AXISBANK", "WIPRO", "BAJFINANCE", "MARUTI",
    "ONGC", "TITAN", "ADANIPORTS", "SUNPHARMA", "NTPC",
    "BAJAJFINSV", "POWERGRID", "ULTRACEMCO", "JSWSTEEL", "HCLTECH",
    "TECHM", "INDUSINDBK", "TATAMOTORS", "DRREDDY", "CIPLA",
    "EICHERMOT", "COALINDIA", "GRASIM", "BPCL", "DIVISLAB",
    "BRITANNIA", "APOLLOHOSP", "DABUR", "PIDILITIND", "HAVELLS",
    "ABBOTINDIA", "DMART", "SIEMENS", "ABB", "NIFTY50",
    "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY",
]

SECTOR_MAP = {
    "RELIANCE": "Energy", "ONGC": "Energy", "BPCL": "Energy",
    "TCS": "IT", "INFY": "IT", "WIPRO": "IT", "HCLTECH": "IT", "TECHM": "IT",
    "HDFCBANK": "Banking", "ICICIBANK": "Banking", "SBIN": "Banking",
    "KOTAKBANK": "Banking", "AXISBANK": "Banking", "INDUSINDBK": "Banking",
    "BAJFINANCE": "NBFC", "BAJAJFINSV": "NBFC",
    "HINDUNILVR": "FMCG", "ITC": "FMCG", "BRITANNIA": "FMCG", "DABUR": "FMCG",
    "SUNPHARMA": "Pharma", "DRREDDY": "Pharma", "CIPLA": "Pharma", "DIVISLAB": "Pharma",
    "MARUTI": "Auto", "TATAMOTORS": "Auto", "EICHERMOT": "Auto",
    "LT": "Infra", "ADANIPORTS": "Infra", "NTPC": "Power", "POWERGRID": "Power",
    "TITAN": "Consumer", "HAVELLS": "Consumer", "SIEMENS": "Capital Goods",
    "ABB": "Capital Goods", "JSWSTEEL": "Metals", "COALINDIA": "Metals",
    "APOLLOHOSP": "Healthcare", "DMART": "Retail",
}


class TickNormaliser:
    """Converts raw feed ticks to Quote objects and computes VWAP."""

    def __init__(self):
        self._session_bars: Dict[str, List[Bar]] = {}
        self._prev_quotes: Dict[str, Quote] = {}

    def process_tick(self, raw: Dict) -> Optional[Quote]:
        symbol = raw.get("symbol", raw.get("tradingsymbol", ""))
        ltp = float(raw.get("last_price", raw.get("ltp", 0)))
        if not symbol or not ltp:
            return None

        quote = Quote(
            symbol=symbol,
            exchange=raw.get("exchange", "NSE"),
            ltp=ltp,
            open=float(raw.get("ohlc", {}).get("open", ltp)),
            high=float(raw.get("ohlc", {}).get("high", ltp)),
            low=float(raw.get("ohlc", {}).get("low", ltp)),
            prev_close=float(raw.get("ohlc", {}).get("close", ltp)),
            volume=float(raw.get("volume_traded", raw.get("volume", 0))),
            oi=float(raw.get("oi", 0)),
            call_oi=float(raw.get("call_oi", 0)),
            put_oi=float(raw.get("put_oi", 0)),
            timestamp=datetime.now(timezone.utc),
        )

        # Accumulate intraday bars (1-min)
        bars = self._session_bars.setdefault(symbol, [])
        now = datetime.now()
        if not bars or bars[-1].timestamp.minute != now.minute:
            bars.append(Bar(
                timestamp=now,
                open=quote.open, high=quote.high, low=quote.low, close=ltp,
                volume=quote.volume, oi=quote.oi,
            ))
        else:
            last = bars[-1]
            bars[-1] = Bar(
                timestamp=last.timestamp,
                open=last.open,
                high=max(last.high, ltp),
                low=min(last.low, ltp),
                close=ltp,
                volume=quote.volume,
                oi=quote.oi,
            )

        self._prev_quotes[symbol] = quote
        return quote

    def get_bars(self, symbol: str) -> List[Bar]:
        return self._session_bars.get(symbol, [])

    def get_vwap(self, symbol: str) -> float:
        bars = self._session_bars.get(symbol, [])
        return Indicators.vwap(bars) if bars else 0.0


class YahooFinanceFeed:
    """
    Development / fallback feed using Yahoo Finance.
    Polls every N seconds and simulates a WebSocket-like stream.
    """

    BASE_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{}"
    NSE_SUFFIX = ".NS"
    POLL_INTERVAL = 5  # seconds

    def __init__(self, normaliser: TickNormaliser, on_tick):
        self.normaliser = normaliser
        self.on_tick = on_tick
        self._running = False

    async def start(self):
        self._running = True
        logger.info("Starting Yahoo Finance feed (dev mode)")
        while self._running:
            tasks = [self._fetch_symbol(sym) for sym in NSE_UNIVERSE[:20]]
            await asyncio.gather(*tasks, return_exceptions=True)
            await asyncio.sleep(self.POLL_INTERVAL)

    async def _fetch_symbol(self, symbol: str):
        yf_symbol = symbol + self.NSE_SUFFIX if not symbol.startswith("NIFTY") else f"^NSEI"
        url = self.BASE_URL.format(yf_symbol)
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=3)) as resp:
                    if resp.status != 200:
                        return
                    data = await resp.json()
                    result = data["chart"]["result"]
                    if not result:
                        return
                    meta = result[0]["meta"]
                    raw = {
                        "symbol": symbol,
                        "exchange": "NSE",
                        "last_price": meta.get("regularMarketPrice", 0),
                        "ohlc": {
                            "open":  meta.get("regularMarketOpen", 0),
                            "high":  meta.get("regularMarketDayHigh", 0),
                            "low":   meta.get("regularMarketDayLow", 0),
                            "close": meta.get("previousClose", 0),
                        },
                        "volume_traded": meta.get("regularMarketVolume", 0),
                    }
                    quote = self.normaliser.process_tick(raw)
                    if quote:
                        await self.on_tick(quote)
        except Exception as e:
            logger.debug(f"YF fetch {symbol}: {e}")


class KiteFeed:
    """
    Production feed using Zerodha Kite WebSocket.
    Requires valid access token.
    """

    WS_URL = "wss://ws.kite.trade"

    def __init__(self, normaliser: TickNormaliser, on_tick):
        self.normaliser = normaliser
        self.on_tick = on_tick
        self._running = False
        self._ws = None

    async def start(self):
        if not settings.KITE_API_KEY or not settings.KITE_ACCESS_TOKEN:
            raise ValueError("Kite credentials not configured")
        self._running = True
        url = (
            f"{self.WS_URL}?api_key={settings.KITE_API_KEY}"
            f"&access_token={settings.KITE_ACCESS_TOKEN}"
        )
        logger.info("Connecting to Kite WebSocket")
        async with aiohttp.ClientSession() as session:
            async with session.ws_connect(url) as ws:
                self._ws = ws
                # Subscribe to instruments
                subscribe_msg = {"a": "subscribe", "v": list(range(256265, 256265 + 50))}
                await ws.send_json(subscribe_msg)
                async for msg in ws:
                    if not self._running:
                        break
                    if msg.type == aiohttp.WSMsgType.BINARY:
                        # Kite sends binary frames — parse with kiteconnect SDK
                        # For demo: skip actual binary parsing
                        pass
                    elif msg.type == aiohttp.WSMsgType.TEXT:
                        data = json.loads(msg.data)
                        for tick in data:
                            quote = self.normaliser.process_tick(tick)
                            if quote:
                                await self.on_tick(quote)

    async def stop(self):
        self._running = False
        if self._ws:
            await self._ws.close()


class MarketDataService:
    """
    Facade that selects the right feed, normalises ticks,
    and publishes enriched quotes to Redis.
    """

    def __init__(self):
        self.normaliser = TickNormaliser()
        self._running = False
        self._feed = None

    async def _on_tick(self, quote: Quote):
        """Called for every normalised tick from any feed."""
        bars = self.normaliser.get_bars(quote.symbol)
        vwap = self.normaliser.get_vwap(quote.symbol)

        change_pct = (
            (quote.ltp - quote.prev_close) / quote.prev_close * 100
            if quote.prev_close else 0.0
        )

        payload = {
            "type": "tick",
            "symbol": quote.symbol,
            "exchange": quote.exchange,
            "sector": SECTOR_MAP.get(quote.symbol, "Other"),
            "ltp": quote.ltp,
            "open": quote.open,
            "high": quote.high,
            "low": quote.low,
            "prev_close": quote.prev_close,
            "change_pct": round(change_pct, 2),
            "volume": quote.volume,
            "oi": quote.oi,
            "vwap": round(vwap, 2),
            "pcr": round(quote.put_oi / quote.call_oi, 2) if quote.call_oi else 0,
            "bars_count": len(bars),
            "timestamp": quote.timestamp.isoformat(),
        }

        # Publish to Redis — WebSocket broadcaster picks this up
        await redis_client.publish(settings.REDIS_CHANNEL_TICKS, json.dumps(payload))

        # Cache latest quote (expire after 1 hour)
        await redis_client.set(
            f"quote:{quote.symbol}",
            json.dumps(payload),
            ex=3600,
        )

    async def start_feed(self):
        self._running = True
        use_kite = bool(settings.KITE_API_KEY and settings.KITE_ACCESS_TOKEN)

        if use_kite:
            self._feed = KiteFeed(self.normaliser, self._on_tick)
        else:
            logger.warning("No Kite credentials — using Yahoo Finance (dev mode)")
            self._feed = YahooFinanceFeed(self.normaliser, self._on_tick)

        try:
            await self._feed.start()
        except Exception as e:
            logger.error(f"Feed error: {e}")

    async def stop(self):
        self._running = False
        if self._feed and hasattr(self._feed, "stop"):
            await self._feed.stop()

    async def get_cached_quote(self, symbol: str) -> Optional[Dict]:
        raw = await redis_client.get(f"quote:{symbol}")
        return json.loads(raw) if raw else None

    async def get_all_quotes(self) -> List[Dict]:
        quotes = []
        for sym in NSE_UNIVERSE:
            q = await self.get_cached_quote(sym)
            if q:
                quotes.append(q)
        return quotes

    def get_bars(self, symbol: str) -> List[Bar]:
        return self.normaliser.get_bars(symbol)
