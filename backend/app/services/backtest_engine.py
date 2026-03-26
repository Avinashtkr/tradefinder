"""
TradeFinder — Backtest Engine
Tests momentum/ORB strategies on historical OHLCV data.
"""
from __future__ import annotations
import asyncio
from dataclasses import dataclass, field
from datetime import datetime, date
from typing import List, Dict, Tuple, Optional
import statistics

from app.strategies.engine import (
    Bar, Quote, Indicators, MomentumDetector,
    VolumeBreakoutDetector, SignalGenerator
)


@dataclass
class Trade:
    symbol: str
    entry_date: date
    entry_price: float
    exit_date: Optional[date]
    exit_price: Optional[float]
    direction: str   # long | short
    signal_type: str
    quantity: int = 1
    pnl: float = 0.0
    pnl_pct: float = 0.0
    bars_held: int = 0
    exit_reason: str = ""   # target|stop|eod|timeout


@dataclass
class BacktestResult:
    strategy: str
    symbols: List[str]
    start_date: date
    end_date: date
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float
    gross_pnl: float
    net_pnl: float
    max_drawdown: float
    sharpe_ratio: float
    avg_win: float
    avg_loss: float
    risk_reward: float
    trades: List[Trade] = field(default_factory=list)
    equity_curve: List[Tuple[str, float]] = field(default_factory=list)


class BacktestEngine:
    """
    Event-driven backtester on 1-min or daily OHLCV bars.
    Strategies: ORB, Volume Breakout, RSI Breakout.
    """

    STRATEGIES = ["orb_breakout", "volume_breakout", "rsi_breakout", "combined"]

    def __init__(
        self,
        strategy: str = "orb_breakout",
        capital: float = 1_000_000,
        risk_per_trade: float = 0.01,   # 1% of capital per trade
        max_hold_bars: int = 20,
        slippage_pct: float = 0.001,    # 0.1% slippage
        commission_pct: float = 0.0003, # 0.03% brokerage
    ):
        if strategy not in self.STRATEGIES:
            raise ValueError(f"Unknown strategy: {strategy}")
        self.strategy = strategy
        self.capital = capital
        self.risk_per_trade = risk_per_trade
        self.max_hold_bars = max_hold_bars
        self.slippage = slippage_pct
        self.commission = commission_pct
        self.detector_momentum = MomentumDetector()
        self.detector_volume = VolumeBreakoutDetector()

    def _position_size(self, price: float, stop_loss: float) -> int:
        risk_amount = self.capital * self.risk_per_trade
        risk_per_share = abs(price - stop_loss)
        if risk_per_share == 0:
            return 0
        return max(1, int(risk_amount / risk_per_share))

    def run(
        self,
        bars_by_symbol: Dict[str, List[Bar]],
        index_bars: Optional[List[Bar]] = None,
    ) -> BacktestResult:
        """
        bars_by_symbol: {"RELIANCE": [Bar, Bar, ...], ...}
        Runs the strategy day by day across all symbols.
        """
        all_trades: List[Trade] = []
        equity = self.capital
        equity_curve: List[Tuple[str, float]] = []
        drawdown_peak = equity

        # Find common date range
        all_dates = sorted(set(
            b.timestamp.date()
            for bars in bars_by_symbol.values()
            for b in bars
        ))

        for current_date in all_dates:
            for symbol, bars in bars_by_symbol.items():
                day_bars = [b for b in bars if b.timestamp.date() == current_date]
                if len(day_bars) < 5:
                    continue

                # Compute historical avg volume (20 trading days)
                hist_bars = [b for b in bars if b.timestamp.date() < current_date]
                if len(hist_bars) < 5:
                    continue
                avg_vol = statistics.mean(b.volume for b in hist_bars[-20:])

                trade = None
                if self.strategy in ("orb_breakout", "combined"):
                    trade = self._run_orb(symbol, day_bars, avg_vol)
                if trade is None and self.strategy in ("volume_breakout", "combined"):
                    trade = self._run_vol_break(symbol, day_bars, avg_vol)
                if trade is None and self.strategy in ("rsi_breakout", "combined"):
                    trade = self._run_rsi(symbol, day_bars)

                if trade:
                    pnl = trade.pnl
                    equity += pnl
                    all_trades.append(trade)
                    drawdown_peak = max(drawdown_peak, equity)
                    current_dd = (drawdown_peak - equity) / drawdown_peak if drawdown_peak else 0
                    equity_curve.append((current_date.isoformat(), round(equity, 2)))

        return self._compute_stats(
            all_trades, equity_curve,
            bars_by_symbol=bars_by_symbol,
        )

    def _run_orb(self, symbol: str, bars: List[Bar], avg_vol: float) -> Optional[Trade]:
        from datetime import time
        orb_bars = [b for b in bars if time(9, 15) <= b.timestamp.time() <= time(9, 25)]
        post_bars = [b for b in bars if b.timestamp.time() > time(9, 25)]
        if not orb_bars or not post_bars:
            return None

        orb_high = max(b.high for b in orb_bars)
        orb_low  = min(b.low  for b in orb_bars)
        orb_vol  = sum(b.volume for b in orb_bars)
        exp_vol  = avg_vol * (10 / 375)

        direction = None
        entry_bar = None
        for bar in post_bars:
            if bar.close > orb_high and orb_vol >= exp_vol * 2:
                direction = "long"
                entry_bar = bar
                break
            if bar.close < orb_low and orb_vol >= exp_vol * 2:
                direction = "short"
                entry_bar = bar
                break

        if not entry_bar:
            return None

        entry_price = entry_bar.close * (1 + self.slippage if direction == "long" else 1 - self.slippage)
        stop_loss = orb_low if direction == "long" else orb_high
        target = entry_price + 2 * (orb_high - orb_low) if direction == "long" else entry_price - 2 * (orb_high - orb_low)
        qty = self._position_size(entry_price, stop_loss)

        exit_price, exit_reason, bars_held = self._simulate_exit(
            post_bars[post_bars.index(entry_bar)+1:],
            direction, entry_price, stop_loss, target,
        )

        raw_pnl = (exit_price - entry_price) * qty if direction == "long" else (entry_price - exit_price) * qty
        commission_cost = (entry_price + exit_price) * qty * self.commission
        net_pnl = raw_pnl - commission_cost

        return Trade(
            symbol=symbol,
            entry_date=entry_bar.timestamp.date(),
            entry_price=round(entry_price, 2),
            exit_date=entry_bar.timestamp.date(),
            exit_price=round(exit_price, 2),
            direction=direction,
            signal_type="orb_breakout",
            quantity=qty,
            pnl=round(net_pnl, 2),
            pnl_pct=round(net_pnl / (entry_price * qty) * 100, 2),
            bars_held=bars_held,
            exit_reason=exit_reason,
        )

    def _run_vol_break(self, symbol: str, bars: List[Bar], avg_vol: float) -> Optional[Trade]:
        if not bars:
            return None
        last = bars[-1]
        if last.volume < avg_vol * 2.5:
            return None
        change_pct = (last.close - bars[0].open) / bars[0].open * 100
        direction = "long" if change_pct > 0.5 else ("short" if change_pct < -0.5 else None)
        if not direction:
            return None
        ep = last.close * (1 + self.slippage if direction == "long" else 1 - self.slippage)
        atr = Indicators.atr(bars, min(14, len(bars) - 1))
        sl = ep - 2 * atr if direction == "long" else ep + 2 * atr
        target = ep + 3 * atr if direction == "long" else ep - 3 * atr
        qty = self._position_size(ep, sl)
        exit_price = target   # simplified: assume target hit next day
        raw_pnl = (exit_price - ep) * qty if direction == "long" else (ep - exit_price) * qty
        comm = (ep + exit_price) * qty * self.commission
        return Trade(
            symbol=symbol, entry_date=last.timestamp.date(),
            entry_price=round(ep, 2), exit_date=last.timestamp.date(),
            exit_price=round(exit_price, 2), direction=direction,
            signal_type="volume_breakout", quantity=qty,
            pnl=round(raw_pnl - comm, 2),
            pnl_pct=round((raw_pnl - comm) / (ep * qty) * 100, 2),
        )

    def _run_rsi(self, symbol: str, bars: List[Bar]) -> Optional[Trade]:
        closes = [b.close for b in bars]
        if len(closes) < 15:
            return None
        rsi = Indicators.rsi(closes, 14)
        prev_rsi = Indicators.rsi(closes[:-1], 14)
        if not (prev_rsi < 60 and rsi >= 60):
            return None
        last = bars[-1]
        ep = last.close * (1 + self.slippage)
        atr = Indicators.atr(bars)
        sl = ep - 1.5 * atr
        target = ep + 2.5 * atr
        qty = self._position_size(ep, sl)
        exit_price, exit_reason, bars_held = self._simulate_exit(bars, "long", ep, sl, target)
        raw_pnl = (exit_price - ep) * qty
        comm = (ep + exit_price) * qty * self.commission
        return Trade(
            symbol=symbol, entry_date=last.timestamp.date(),
            entry_price=round(ep, 2), exit_date=last.timestamp.date(),
            exit_price=round(exit_price, 2), direction="long",
            signal_type="rsi_breakout", quantity=qty,
            pnl=round(raw_pnl - comm, 2),
            pnl_pct=round((raw_pnl - comm) / (ep * qty) * 100, 2),
            bars_held=bars_held, exit_reason=exit_reason,
        )

    def _simulate_exit(
        self, bars: List[Bar], direction: str,
        entry: float, stop: float, target: float,
    ) -> Tuple[float, str, int]:
        for i, bar in enumerate(bars[:self.max_hold_bars]):
            if direction == "long":
                if bar.low <= stop:
                    return stop * (1 - self.slippage), "stop", i + 1
                if bar.high >= target:
                    return target * (1 + self.slippage), "target", i + 1
            else:
                if bar.high >= stop:
                    return stop * (1 + self.slippage), "stop", i + 1
                if bar.low <= target:
                    return target * (1 - self.slippage), "target", i + 1
        last = bars[min(self.max_hold_bars - 1, len(bars) - 1)].close if bars else entry
        return last, "timeout", min(self.max_hold_bars, len(bars))

    def _compute_stats(
        self, trades: List[Trade], equity_curve, **kwargs
    ) -> BacktestResult:
        if not trades:
            return BacktestResult(
                strategy=self.strategy, symbols=[], start_date=date.today(),
                end_date=date.today(), total_trades=0, winning_trades=0,
                losing_trades=0, win_rate=0, gross_pnl=0, net_pnl=0,
                max_drawdown=0, sharpe_ratio=0, avg_win=0, avg_loss=0,
                risk_reward=0, trades=[], equity_curve=[],
            )
        winners = [t for t in trades if t.pnl > 0]
        losers  = [t for t in trades if t.pnl <= 0]
        pnls = [t.pnl for t in trades]
        net_pnl = sum(pnls)
        avg_win = statistics.mean(t.pnl for t in winners) if winners else 0
        avg_loss = abs(statistics.mean(t.pnl for t in losers)) if losers else 0

        # Max drawdown
        running_max = 0
        max_dd = 0
        cumulative = 0
        for pnl in pnls:
            cumulative += pnl
            running_max = max(running_max, cumulative)
            dd = running_max - cumulative
            max_dd = max(max_dd, dd)

        # Sharpe (simplified, daily)
        if len(pnls) > 1:
            std = statistics.stdev(pnls)
            sharpe = (statistics.mean(pnls) / std * (252 ** 0.5)) if std else 0
        else:
            sharpe = 0

        syms = list({t.symbol for t in trades})
        dates = sorted(t.entry_date for t in trades)

        return BacktestResult(
            strategy=self.strategy,
            symbols=syms,
            start_date=dates[0] if dates else date.today(),
            end_date=dates[-1] if dates else date.today(),
            total_trades=len(trades),
            winning_trades=len(winners),
            losing_trades=len(losers),
            win_rate=round(len(winners) / len(trades) * 100, 2),
            gross_pnl=round(sum(pnls), 2),
            net_pnl=round(net_pnl, 2),
            max_drawdown=round(max_dd, 2),
            sharpe_ratio=round(sharpe, 2),
            avg_win=round(avg_win, 2),
            avg_loss=round(avg_loss, 2),
            risk_reward=round(avg_win / avg_loss, 2) if avg_loss else 0,
            trades=trades,
            equity_curve=equity_curve,
        )
