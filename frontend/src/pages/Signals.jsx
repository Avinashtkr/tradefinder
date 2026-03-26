// TradeFinder — Signals Page (full signal history + stats)
import React, { useState } from 'react'
import { useSelector } from 'react-redux'
import { selectSignals } from '../store/marketSlice'

const SIGNAL_TYPE_LABELS = {
  bullish_breakout:  { label: 'Bullish Breakout',  color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  bearish_breakdown: { label: 'Bearish Breakdown', color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/30'         },
  volume_surge:      { label: 'Volume Surge',      color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/30'     },
  oi_buildup_long:   { label: 'Long Buildup',      color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/30'       },
  oi_buildup_short:  { label: 'Short Buildup',     color: 'text-pink-400',    bg: 'bg-pink-500/10 border-pink-500/30'       },
  vwap_reclaim:      { label: 'VWAP Reclaim',      color: 'text-cyan-400',    bg: 'bg-cyan-500/10 border-cyan-500/30'       },
  rsi_breakout:      { label: 'RSI Breakout',      color: 'text-violet-400',  bg: 'bg-violet-500/10 border-violet-500/30'   },
}

function StatPill({ label, count, color }) {
  return (
    <div className={`rounded-xl px-4 py-3 border ${color}`}>
      <div className="text-2xl font-bold font-mono">{count}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}

export default function Signals() {
  const allSignals = useSelector(selectSignals)
  const [typeFilter, setTypeFilter] = useState('all')
  const [minConf, setMinConf] = useState(0)
  const [sectorFilter, setSectorFilter] = useState('All')
  const [sortKey, setSortKey] = useState('generated_at')

  const sectors = ['All', ...new Set(allSignals.map(s => s.sector || 'Other').filter(Boolean))]

  const filtered = allSignals.filter(s => {
    if (typeFilter !== 'all' && s.signal_type !== typeFilter) return false
    if ((s.confidence || 0) < minConf / 100) return false
    if (sectorFilter !== 'All' && s.sector !== sectorFilter) return false
    return true
  })

  // Stats
  const bullish = allSignals.filter(s => ['bullish_breakout', 'vwap_reclaim', 'oi_buildup_long'].includes(s.signal_type)).length
  const bearish = allSignals.filter(s => ['bearish_breakdown', 'oi_buildup_short'].includes(s.signal_type)).length
  const highConf = allSignals.filter(s => (s.confidence || 0) >= 0.80).length
  const avgConf = allSignals.length
    ? Math.round(allSignals.reduce((a, s) => a + (s.confidence || 0), 0) / allSignals.length * 100)
    : 0

  const formatTime = iso => {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-5 py-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-base font-bold text-white">Live Signal Feed</h1>
          <div className="text-xs text-gray-500">
            {filtered.length} / {allSignals.length} signals shown
          </div>
        </div>
        {/* Stats row */}
        <div className="flex gap-3 flex-wrap">
          <StatPill label="Total Signals" count={allSignals.length} color="border-gray-700" />
          <StatPill label="Bullish" count={bullish} color="border-emerald-500/30 text-emerald-400" />
          <StatPill label="Bearish" count={bearish} color="border-red-500/30 text-red-400" />
          <StatPill label="High Confidence" count={highConf} color="border-amber-500/30 text-amber-400" />
          <StatPill label="Avg Confidence" count={`${avgConf}%`} color="border-gray-700" />
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-900/50 border-b border-gray-800 px-5 py-2 flex items-center gap-4 flex-wrap">
        {/* Type filter */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 mr-1">Type:</span>
          <button
            onClick={() => setTypeFilter('all')}
            className={`text-xs px-2.5 py-1 rounded-full transition-all ${typeFilter === 'all' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            All
          </button>
          {Object.entries(SIGNAL_TYPE_LABELS).map(([type, cfg]) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`text-xs px-2.5 py-1 rounded-full transition-all ${typeFilter === type ? `${cfg.bg} border ${cfg.color}` : 'text-gray-500 hover:text-gray-300'}`}
            >
              {cfg.label}
            </button>
          ))}
        </div>

        {/* Confidence slider */}
        <div className="flex items-center gap-2 ml-4">
          <span className="text-xs text-gray-500">Min Confidence:</span>
          <input
            type="range" min={0} max={90} step={5} value={minConf}
            onChange={e => setMinConf(Number(e.target.value))}
            className="w-24 accent-emerald-500"
          />
          <span className="text-xs text-emerald-400 font-mono w-8">{minConf}%</span>
        </div>

        {/* Sector */}
        <div className="flex items-center gap-1 ml-2">
          <span className="text-xs text-gray-500">Sector:</span>
          <select
            value={sectorFilter}
            onChange={e => setSectorFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-xs text-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-emerald-500"
          >
            {sectors.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Signal Table */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-600 space-y-2">
            <span className="text-3xl opacity-20">⚡</span>
            <span className="text-sm">No signals match current filters</span>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-900/95 backdrop-blur-sm z-10">
              <tr className="border-b border-gray-800">
                {['Time', 'Symbol', 'Exchange', 'Sector', 'Signal', 'Price', 'Target', 'Stop Loss', 'Confidence', 'Details'].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/40">
              {filtered.map(sig => {
                const cfg = SIGNAL_TYPE_LABELS[sig.signal_type] || { label: sig.signal_type, color: 'text-gray-400', bg: 'bg-gray-800 border-gray-700' }
                const confPct = Math.round((sig.confidence || 0) * 100)
                return (
                  <tr key={sig.id} className="hover:bg-gray-800/30 transition-colors group">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{formatTime(sig.generated_at)}</td>
                    <td className="px-4 py-3 font-bold text-white">{sig.symbol}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{sig.exchange}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{sig.sector || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-white">
                      {sig.trigger_price ? `₹${sig.trigger_price.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-emerald-400">
                      {sig.target_price ? `₹${sig.target_price.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-red-400">
                      {sig.stop_loss ? `₹${sig.stop_loss.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${confPct >= 80 ? 'bg-emerald-500' : confPct >= 60 ? 'bg-amber-500' : 'bg-gray-600'}`}
                            style={{ width: `${confPct}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-gray-400">{confPct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {sig.metadata && (
                        <span>
                          {sig.metadata.vol_ratio && `Vol ${sig.metadata.vol_ratio}x`}
                          {sig.metadata.rsi && ` RSI ${sig.metadata.rsi}`}
                          {sig.metadata.pcr && ` PCR ${sig.metadata.pcr}`}
                          {sig.metadata.pattern && ` ${sig.metadata.pattern}`}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
