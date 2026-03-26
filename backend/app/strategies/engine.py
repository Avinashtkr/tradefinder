"""
TradeFinder — Strategy Engine
Core algorithms: momentum, volume breakout, sector strength, RS scoring, option chain
"""
from __future__ import annotations
import math
from dataclasses import dataclass, field
from datetime import datetime, time
from typing import List, Optional, Dict, Tuple
import statistics


# ── Data Structures ───────────────────────────────────────────────────────────

@dataclass
class Bar:
    """Single OHLCV bar."""
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float
    oi: float = 0.0

@dataclass
class Quote:
    """Live market quote."""
    symbol: str
    exchange: str
    ltp: float
    open: float
    high: float
    low: float
    prev_close: float
    volume: float
    oi: float = 0.0
    call_oi: float = 0.0
    put_oi: float = 0.0
    bid: float = 0.0
    ask: float = 0.0
    timestamp: datetime = field(default_factory=datetime.utcnow)

@dataclass
class Signal:
    symbol: str
    exchange: str
    signal_type: str
    confidence: float          # 0-1
    trigger_price: float
    target_price: Optional[float] = None
    stop_loss: Optional[float] = None
    metadata: Dict = field(default_factory=dict)
    generated_at: datetime = field(default_factory=datetime.utcnow)


# ── Technical Indicators ──────────────────────────────────────────────────────

class Indicators:
    """Pure-function indicator library — no external deps."""

    @staticmethod
    def ema(values: List[float], period: int) -> List[float]:
        if len(values) < period:
            return []
        k = 2 / (period + 1)
        result = [sum(values[:period]) / period]
        for v in values[period:]:
            result.append(v * k + result[-1] * (1 - k))
        return result

    @staticmethod
    def sma(values: List[float], period: int) -> List[float]:
        return [
            sum(values[i:i+period]) / period
            for i in range(len(values) - period + 1)
        ]

    @staticmethod
    def rsi(closes: List[float], period: int = 14) -> float:
        if len(closes) < period + 1:
            return 50.0
        deltas = [closes[i+1] - closes[i] for i in range(len(closes)-1)]
        gains = [max(d, 0) for d in deltas[-period:]]
        losses = [abs(min(d, 0)) for d in deltas[-period:]]
        avg_gain = sum(gains) / period
        avg_loss = sum(losses) / period
        if avg_loss == 0:
            return 100.0
        rs = avg_gain / avg_loss
        return 100 - (100 / (1 + rs))

    @staticmethod
    def atr(bars: List[Bar], period: int = 14) -> float:
        if len(bars) < 2:
            return 0.0
        trs = []
        for i in range(1, len(bars)):
            prev_close = bars[i-1].close
            tr = max(
                bars[i].high - bars[i].low,
                abs(bars[i].high - prev_close),
                abs(bars[i].low - prev_close),
            )
            trs.append(tr)
        return sum(trs[-period:]) / min(period, len(trs))

    @staticmethod
    def vwap(bars: List[Bar]) -> float:
        """Session VWAP from intraday bars."""
        total_pv = sum(((b.high + b.low + b.close) / 3) * b.volume for b in bars)
        total_vol = sum(b.volume for b in bars)
        return total_pv / total_vol if total_vol else 0.0

    @staticmethod
    def bollinger_bands(
        closes: List[float], period: int = 20, std_mult: float = 2.0
    ) -> Tuple[float, float, float]:
        if len(closes) < period:
            return 0.0, 0.0, 0.0
        window = closes[-period:]
        mid = sum(window) / period
        variance = sum((x - mid) ** 2 for x in window) / period
        std = math.sqrt(variance)
        return mid + std_mult * std, mid, mid - std_mult * std

    @staticmethod
    def supertrend(bars: List[Bar], period: int = 10, mult: float = 3.0) -> str:
        """Returns 'bullish' or 'bearish'."""
        if len(bars) < period + 1:
            return "neutral"
        atr_val = Indicators.atr(bars, period)
        last = bars[-1]
        hl2 = (last.high + last.low) / 2
        upper = hl2 + mult * atr_val
        lower = hl2 - mult * atr_val
        return "bullish" if last.close > lower else "bearish"


# ── Intraday Momentum Detector ─────────────────────────────────────────────────

class MomentumDetector:
    """
    Detects intraday momentum at the 9:20-9:25 opening range breakout (ORB).
    Also scores continuous momentum throughout the session.
    """

    ORB_START = time(9, 15)
    ORB_END   = time(9, 25)

    def __init__(self, threshold_pct: float = 0.5, volume_mult: float = 2.0):
        self.threshold_pct = threshold_pct
        self.volume_mult = volume_mult

    def detect_orb(
        self,
        bars: List[Bar],
        avg_volume: float,
    ) -> Optional[Signal]:
        """
        Opening Range Breakout: price breaks above/below 9:15-9:25 high/low
        with volume surge.
        """
        orb_bars = [
            b for b in bars
            if self.ORB_START <= b.timestamp.time() <= self.ORB_END
        ]
        if not orb_bars:
            return None

        orb_high = max(b.high for b in orb_bars)
        orb_low  = min(b.low  for b in orb_bars)
        orb_vol  = sum(b.volume for b in orb_bars)
        expected_vol = avg_volume * (10 / 375)   # 10 min fraction of day

        # Post-ORB bars
        post_bars = [b for b in bars if b.timestamp.time() > self.ORB_END]
        if not post_bars:
            return None

        last = post_bars[-1]
        vol_ratio = orb_vol / expected_vol if expected_vol else 0

        # Bullish ORB
        if last.close > orb_high and vol_ratio >= self.volume_mult:
            rr = (last.close - orb_high) / (orb_high - orb_low) if (orb_high - orb_low) > 0 else 0
            confidence = min(0.95, 0.5 + 0.2 * min(vol_ratio / self.volume_mult, 2) + 0.15 * min(rr, 1))
            change_pct = (last.close - orb_high) / orb_high * 100
            return Signal(
                symbol=bars[0].timestamp.strftime(""),  # set by caller
                exchange="",
                signal_type="bullish_breakout",
                confidence=round(confidence, 3),
                trigger_price=last.close,
                target_price=round(last.close + (orb_high - orb_low), 2),
                stop_loss=round(orb_high - 0.002 * orb_high, 2),
                metadata={
                    "orb_high": orb_high,
                    "orb_low": orb_low,
                    "vol_ratio": round(vol_ratio, 2),
                    "change_pct": round(change_pct, 2),
                    "pattern": "ORB_BREAKOUT",
                },
            )

        # Bearish ORB
        if last.close < orb_low and vol_ratio >= self.volume_mult:
            confidence = min(0.95, 0.5 + 0.2 * min(vol_ratio / self.volume_mult, 2))
            return Signal(
                symbol="",
                exchange="",
                signal_type="bearish_breakdown",
                confidence=round(confidence, 3),
                trigger_price=last.close,
                target_price=round(last.close - (orb_high - orb_low), 2),
                stop_loss=round(orb_low + 0.002 * orb_low, 2),
                metadata={
                    "orb_high": orb_high,
                    "orb_low": orb_low,
                    "vol_ratio": round(vol_ratio, 2),
                    "pattern": "ORB_BREAKDOWN",
                },
            )
        return None

    def momentum_score(self, bars: List[Bar]) -> float:
        """
        Score 0-1 representing current momentum intensity.
        Combines price velocity, volume, and consistency.
        """
        if len(bars) < 5:
            return 0.0
        closes = [b.close for b in bars[-10:]]
        vols = [b.volume for b in bars[-10:]]

        # Price velocity: linear regression slope normalised
        n = len(closes)
        xs = list(range(n))
        mean_x, mean_y = sum(xs) / n, sum(closes) / n
        slope = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, closes))
        slope /= sum((x - mean_x) ** 2 for x in xs) or 1
        norm_slope = slope / (mean_y or 1) * 100   # % per bar

        # Volume trend
        recent_vol = sum(vols[-3:]) / 3 if vols else 0
        older_vol  = sum(vols[-10:-3]) / 7 if len(vols) >= 10 else recent_vol
        vol_factor = recent_vol / older_vol if older_vol else 1

        # Consistency: bars closing above previous close
        up_bars = sum(1 for i in range(1, len(closes)) if closes[i] > closes[i-1])
        consistency = up_bars / (len(closes) - 1)

        score = (
            0.4 * min(abs(norm_slope) / 0.5, 1.0) * (1 if norm_slope > 0 else -1)
            + 0.3 * min(vol_factor / 2, 1.0)
            + 0.3 * consistency
        )
        return round(max(-1.0, min(1.0, score)), 3)


# ── Volume Breakout Detector ───────────────────────────────────────────────────

class VolumeBreakoutDetector:

    def __init__(self, surge_mult: float = 2.5, lookback: int = 20):
        self.surge_mult = surge_mult
        self.lookback = lookback

    def detect(self, bars: List[Bar], quote: Quote) -> Optional[Signal]:
        if len(bars) < self.lookback:
            return None

        daily_vols = [b.volume for b in bars[-self.lookback:]]
        avg_vol = statistics.mean(daily_vols)
        std_vol = statistics.stdev(daily_vols) if len(daily_vols) > 1 else 0

        if quote.volume < avg_vol * self.surge_mult:
            return None

        z_score = (quote.volume - avg_vol) / std_vol if std_vol else 0
        change_pct = (quote.ltp - quote.prev_close) / quote.prev_close * 100
        is_bullish = change_pct > 0

        confidence = min(0.95, 0.55 + 0.15 * min(z_score / 3, 2))

        return Signal(
            symbol=quote.symbol,
            exchange=quote.exchange,
            signal_type="volume_surge",
            confidence=round(confidence, 3),
            trigger_price=quote.ltp,
            metadata={
                "vol_ratio": round(quote.volume / avg_vol, 2),
                "z_score": round(z_score, 2),
                "change_pct": round(change_pct, 2),
                "direction": "long" if is_bullish else "short",
                "avg_volume_20d": round(avg_vol, 0),
            },
        )


# ── Sector Strength Ranker ─────────────────────────────────────────────────────

class SectorStrengthRanker:
    """
    Scores each sector relative to Nifty 50 using RS (Relative Strength).
    """

    def compute_rs(
        self,
        stock_closes: List[float],
        index_closes: List[float],
        period: int = 63,   # ~3 months of trading days
    ) -> float:
        """RS factor: stock return / index return over period."""
        if len(stock_closes) < period or len(index_closes) < period:
            return 1.0
        stock_ret = stock_closes[-1] / stock_closes[-period] - 1
        idx_ret   = index_closes[-1] / index_closes[-period] - 1
        return (1 + stock_ret) / (1 + idx_ret) if (1 + idx_ret) != 0 else 1.0

    def rank_sectors(
        self,
        sector_returns: Dict[str, float],   # {sector: avg_return_pct}
    ) -> List[Tuple[str, float, str]]:
        """Returns ranked list of (sector, score, strength_label)."""
        if not sector_returns:
            return []
        sorted_sectors = sorted(sector_returns.items(), key=lambda x: x[1], reverse=True)
        n = len(sorted_sectors)
        ranked = []
        for rank, (sector, ret) in enumerate(sorted_sectors):
            pct_rank = 1 - rank / n
            if pct_rank >= 0.8:
                label = "Very Strong"
            elif pct_rank >= 0.6:
                label = "Strong"
            elif pct_rank >= 0.4:
                label = "Neutral"
            elif pct_rank >= 0.2:
                label = "Weak"
            else:
                label = "Very Weak"
            ranked.append((sector, round(pct_rank, 3), label))
        return ranked


# ── Option Chain Analyzer ──────────────────────────────────────────────────────

class OptionChainAnalyzer:
    """
    Analyzes option chain data for PCR, OI buildup, and max pain.
    """

    def compute_pcr(self, put_oi: float, call_oi: float) -> float:
        """Put-Call Ratio. >1.2 = bullish sentiment, <0.8 = bearish."""
        return put_oi / call_oi if call_oi > 0 else 1.0

    def detect_oi_buildup(
        self,
        symbol: str,
        quote: Quote,
        prev_oi: float,
        prev_close: float,
    ) -> Optional[Signal]:
        """
        Long buildup: price up + OI up
        Short buildup: price down + OI up
        Short covering: price up + OI down
        """
        if prev_oi == 0 or prev_close == 0:
            return None

        oi_change_pct = (quote.oi - prev_oi) / prev_oi * 100
        price_change_pct = (quote.ltp - prev_close) / prev_close * 100

        if abs(oi_change_pct) < 2:   # insignificant OI change
            return None

        if oi_change_pct > 2 and price_change_pct > 0.3:
            signal_type = "oi_buildup_long"
            confidence = min(0.90, 0.55 + 0.02 * min(oi_change_pct, 10))
        elif oi_change_pct > 2 and price_change_pct < -0.3:
            signal_type = "oi_buildup_short"
            confidence = min(0.90, 0.55 + 0.02 * min(oi_change_pct, 10))
        else:
            return None

        pcr = self.compute_pcr(quote.put_oi, quote.call_oi)
        return Signal(
            symbol=symbol,
            exchange=quote.exchange,
            signal_type=signal_type,
            confidence=round(confidence, 3),
            trigger_price=quote.ltp,
            metadata={
                "oi_change_pct": round(oi_change_pct, 2),
                "price_change_pct": round(price_change_pct, 2),
                "pcr": round(pcr, 2),
                "total_oi": quote.oi,
            },
        )

    def max_pain(self, strikes: Dict[float, Dict]) -> float:
        """
        Find the strike where option writers lose the least (max pain theory).
        strikes: {strike_price: {"call_oi": ..., "put_oi": ...}}
        """
        pain = {}
        for target_strike in strikes:
            total_pain = 0
            for strike, oi_data in strikes.items():
                call_pain = max(0, strike - target_strike) * oi_data.get("call_oi", 0)
                put_pain  = max(0, target_strike - strike) * oi_data.get("put_oi", 0)
                total_pain += call_pain + put_pain
            pain[target_strike] = total_pain
        return min(pain, key=pain.get) if pain else 0.0


# ── Master Signal Generator ───────────────────────────────────────────────────

class SignalGenerator:
    """
    Orchestrates all strategy modules and returns deduplicated signals.
    """

    def __init__(self):
        self.momentum   = MomentumDetector()
        self.vol_break  = VolumeBreakoutDetector()
        self.sector     = SectorStrengthRanker()
        self.options    = OptionChainAnalyzer()

    def generate(
        self,
        symbol: str,
        exchange: str,
        bars: List[Bar],
        quote: Quote,
        avg_volume: float,
        index_closes: List[float],
        prev_oi: float = 0.0,
    ) -> List[Signal]:
        signals: List[Signal] = []

        # 1. ORB / Momentum
        orb_signal = self.momentum.detect_orb(bars, avg_volume)
        if orb_signal:
            orb_signal.symbol = symbol
            orb_signal.exchange = exchange
            signals.append(orb_signal)

        # 2. Volume Breakout
        vol_signal = self.vol_break.detect(bars, quote)
        if vol_signal:
            signals.append(vol_signal)

        # 3. OI Buildup
        oi_signal = self.options.detect_oi_buildup(
            symbol, quote, prev_oi, bars[-1].close if bars else 0
        )
        if oi_signal:
            signals.append(oi_signal)

        # 4. RSI Breakout (from neutral zone)
        if len(bars) >= 20:
            closes = [b.close for b in bars]
            rsi = Indicators.rsi(closes, 14)
            prev_rsi = Indicators.rsi(closes[:-1], 14)
            if prev_rsi < 60 and rsi >= 60:
                momentum_score = self.momentum.momentum_score(bars)
                signals.append(Signal(
                    symbol=symbol,
                    exchange=exchange,
                    signal_type="rsi_breakout",
                    confidence=round(min(0.85, 0.55 + 0.15 * momentum_score), 3),
                    trigger_price=quote.ltp,
                    metadata={"rsi": round(rsi, 2), "prev_rsi": round(prev_rsi, 2)},
                ))

        # 5. VWAP signal
        if bars:
            vwap = Indicators.vwap(bars[-78:])   # ~325 min session in 5m bars
            if vwap > 0:
                diff_pct = (quote.ltp - vwap) / vwap * 100
                if diff_pct > 0.3 and bars[-1].close < vwap and quote.ltp > vwap:
                    signals.append(Signal(
                        symbol=symbol, exchange=exchange,
                        signal_type="vwap_reclaim",
                        confidence=0.72,
                        trigger_price=quote.ltp,
                        metadata={"vwap": round(vwap, 2)},
                    ))

        return signals

    def high_momentum_label(self, score: float) -> str:
        if score >= 0.7:
            return "High Momentum"
        elif score >= 0.4:
            return "Moderate Momentum"
        elif score <= -0.7:
            return "Strong Sell Pressure"
        elif score <= -0.4:
            return "Sell Pressure"
        return "Neutral"
