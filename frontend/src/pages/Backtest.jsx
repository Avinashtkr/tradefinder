// TradeFinder — Backtest Page
import React, { useState } from 'react'
import { useSelector } from 'react-redux'
import api from '../services/api'

const STRATEGIES = [
  { id: 'orb_breakout',    label: 'ORB Breakout (9:20-9:25)', tier: 'basic'   },
  { id: 'volume_breakout', label: 'Volume Surge Breakout',    tier: 'basic'   },
  { id: 'rsi_breakout',    label: 'RSI Breakout (60 cross)',  tier: 'premium' },
  { id: 'combined',        label: 'Combined Strategy',        tier: 'premium' },
]

const NSE_STOCKS = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'BHARTIARTL', 'ITC', 'KOTAKBANK', 'LT']

function MetricCard({ label, value, sub, color }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-xl font-bold font-mono ${color || 'text-white'}`}>{value}</div>
      {sub && <div className="text-xs text-gray-600 mt-0.5">{sub}</div>}
    </div>
  )
}

export default function Backtest() {
  const userTier = useSelector(s => s.auth.user?.tier || 'free')
  const [strategy, setStrategy] = useState('orb_breakout')
  const [symbols, setSymbols] = useState(['RELIANCE', 'TCS', 'HDFCBANK'])
  const [startDate, setStartDate] = useState('2024-01-01')
  const [endDate, setEndDate] = useState('2024-12-31')
  const [capital, setCapital] = useState(1000000)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleRun = async () => {
    setRunning(true)
    setError(null)
    try {
      const res = await api.post('/backtest/run', {
        strategy_name: strategy,
        universe: symbols,
        start_date: startDate,
        end_date: endDate,
        parameters: { capital, risk_per_trade: 0.01 },
      })
      setResult(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Backtest failed')
    } finally {
      setRunning(false)
    }
  }

  const toggleSymbol = sym => {
    setSymbols(s => s.includes(sym) ? s.filter(x => x !== sym) : [...s, sym])
  }

  return (
    <div className="flex h-full">
      {/* Config panel */}
      <div className="w-72 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">
        <div className="px-4 py-3 border-b border-gray-800">
          <h2 className="text-sm font-bold text-white">Backtest Configuration</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* Strategy */}
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Strategy</div>
            <div className="space-y-1.5">
              {STRATEGIES.map(s => (
                <button
                  key={s.id}
                  onClick={() => setStrategy(s.id)}
                  disabled={s.tier === 'premium' && userTier !== 'premium'}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-xs border transition-all ${
                    strategy === s.id
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                      : s.tier === 'premium' && userTier !== 'premium'
                        ? 'border-gray-800 text-gray-600 cursor-not-allowed'
                        : 'border-gray-700 text-gray-300 hover:border-gray-600 hover:text-white'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span>{s.label}</span>
                    {s.tier !== 'free' && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold uppercase ${
                        s.tier === 'premium' ? 'text-amber-400 bg-amber-500/20' : 'text-blue-400 bg-blue-500/20'
                      }`}>{s.tier}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Universe */}
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
              Stock Universe ({symbols.length} selected)
            </div>
            <div className="flex flex-wrap gap-1.5">
              {NSE_STOCKS.map(sym => (
                <button
                  key={sym}
                  onClick={() => toggleSymbol(sym)}
                  className={`text-xs px-2 py-1 rounded-full border transition-all ${
                    symbols.includes(sym)
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : 'text-gray-500 border-gray-700 hover:text-gray-300'
                  }`}
                >
                  {sym}
                </button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Date Range</div>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-gray-600 block mb-1">Start Date</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">End Date</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Capital */}
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2">Starting Capital (₹)</label>
            <input
              type="number"
              value={capital}
              onChange={e => setCapital(Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="p-4 border-t border-gray-800">
          <button
            onClick={handleRun}
            disabled={running || symbols.length === 0}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-3 rounded-xl transition-all text-sm"
          >
            {running ? '↺  Running...' : '↺  Run Backtest'}
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 flex flex-col bg-gray-950 overflow-auto">
        <div className="px-5 py-3 border-b border-gray-800 bg-gray-900">
          <h2 className="text-sm font-bold text-white">Backtest Results</h2>
        </div>

        <div className="flex-1 p-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl mb-4">{error}</div>
          )}

          {!result && !running && (
            <div className="flex flex-col items-center justify-center h-64 text-gray-600 space-y-3">
              <span className="text-5xl opacity-10">↺</span>
              <span className="text-sm">Configure parameters and run a backtest</span>
              <span className="text-xs text-gray-700">Results include win rate, PnL, Sharpe ratio, and trade log</span>
            </div>
          )}

          {running && (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 space-y-3">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Running strategy on historical data...</span>
            </div>
          )}

          {result && !running && (
            <div className="space-y-6">
              {/* Summary metrics */}
              <div className="grid grid-cols-4 gap-4">
                <MetricCard label="Total Trades" value={result.total_trades} />
                <MetricCard label="Win Rate" value={`${result.win_rate}%`} color={result.win_rate >= 50 ? 'text-emerald-400' : 'text-red-400'} />
                <MetricCard label="Net PnL" value={`₹${result.net_pnl?.toLocaleString('en-IN')}`} color={result.net_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'} />
                <MetricCard label="Sharpe Ratio" value={result.sharpe_ratio?.toFixed(2)} color={result.sharpe_ratio >= 1 ? 'text-emerald-400' : 'text-amber-400'} />
              </div>
              <div className="grid grid-cols-4 gap-4">
                <MetricCard label="Max Drawdown" value={`₹${result.max_drawdown?.toLocaleString('en-IN')}`} color="text-red-400" />
                <MetricCard label="Avg Win" value={`₹${result.avg_win?.toLocaleString('en-IN')}`} color="text-emerald-400" />
                <MetricCard label="Avg Loss" value={`₹${result.avg_loss?.toLocaleString('en-IN')}`} color="text-red-400" />
                <MetricCard label="Risk:Reward" value={`1:${result.risk_reward?.toFixed(2)}`} color={result.risk_reward >= 2 ? 'text-emerald-400' : 'text-amber-400'} />
              </div>

              {/* Trade log */}
              {result.trades && result.trades.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-white mb-3">Trade Log ({result.trades.length} trades)</h3>
                  <div className="overflow-auto rounded-xl border border-gray-800">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-900">
                        <tr className="border-b border-gray-800">
                          {['Symbol', 'Direction', 'Signal', 'Entry', 'Exit', 'Qty', 'PnL', 'PnL %', 'Exit Reason'].map(h => (
                            <th key={h} className="px-3 py-2.5 text-left text-gray-500 uppercase tracking-wider font-semibold">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/50">
                        {result.trades.slice(0, 100).map((t, i) => (
                          <tr key={i} className="hover:bg-gray-800/20">
                            <td className="px-3 py-2 font-bold text-white">{t.symbol}</td>
                            <td className={`px-3 py-2 font-semibold ${t.direction === 'long' ? 'text-emerald-400' : 'text-red-400'}`}>
                              {t.direction?.toUpperCase()}
                            </td>
                            <td className="px-3 py-2 text-gray-400">{t.signal_type?.replace('_', ' ')}</td>
                            <td className="px-3 py-2 font-mono">₹{t.entry_price?.toFixed(2)}</td>
                            <td className="px-3 py-2 font-mono">₹{t.exit_price?.toFixed(2)}</td>
                            <td className="px-3 py-2 font-mono">{t.quantity}</td>
                            <td className={`px-3 py-2 font-mono font-bold ${t.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {t.pnl >= 0 ? '+' : ''}₹{t.pnl?.toFixed(0)}
                            </td>
                            <td className={`px-3 py-2 font-mono ${t.pnl_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {t.pnl_pct >= 0 ? '+' : ''}{t.pnl_pct?.toFixed(2)}%
                            </td>
                            <td className="px-3 py-2 text-gray-500 capitalize">{t.exit_reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
