// TradeFinder — Screener Page
import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { runScreener, loadPresets, setFilter, applyPreset, resetFilters } from '../store/screenerSlice'

const SECTORS = ['Banking', 'IT', 'Pharma', 'Auto', 'FMCG', 'Energy', 'Metals', 'NBFC', 'Infra', 'Power']
const SIGNAL_TYPES = [
  { value: 'bullish_breakout',  label: 'Bullish Breakout' },
  { value: 'bearish_breakdown', label: 'Bearish Breakdown' },
  { value: 'volume_surge',      label: 'Volume Surge' },
  { value: 'oi_buildup_long',   label: 'OI Long Buildup' },
  { value: 'oi_buildup_short',  label: 'OI Short Buildup' },
  { value: 'vwap_reclaim',      label: 'VWAP Reclaim' },
  { value: 'rsi_breakout',      label: 'RSI Breakout' },
]

function FilterInput({ label, value, onChange, placeholder, type = 'number' }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
        placeholder={placeholder}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
      />
    </div>
  )
}

function ToggleFilter({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <div className="flex gap-1">
        {[
          { v: null, l: 'Any' },
          { v: true, l: 'Yes' },
          { v: false, l: 'No' },
        ].map(opt => (
          <button
            key={String(opt.v)}
            onClick={() => onChange(opt.v)}
            className={`flex-1 text-xs py-2 rounded-lg border transition-all ${
              value === opt.v
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                : 'border-gray-700 text-gray-500 hover:text-gray-300'
            }`}
          >
            {opt.l}
          </button>
        ))}
      </div>
    </div>
  )
}

const TIER_COLORS = {
  free: 'text-gray-400 bg-gray-700',
  basic: 'text-blue-400 bg-blue-500/20',
  premium: 'text-amber-400 bg-amber-500/20',
}

export default function Screener() {
  const dispatch = useDispatch()
  const { results, presets, filters, loading, error, lastRun } = useSelector(s => s.screener)
  const userTier = useSelector(s => s.auth.user?.tier || 'free')

  useEffect(() => {
    dispatch(loadPresets())
  }, [dispatch])

  const handleRun = () => dispatch(runScreener(filters))

  return (
    <div className="flex h-full">
      {/* Filter panel */}
      <div className="w-72 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Screener Filters</h2>
          <button onClick={() => dispatch(resetFilters())} className="text-xs text-gray-500 hover:text-red-400 transition-colors">Reset</button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* Presets */}
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Quick Presets</div>
            <div className="space-y-1.5">
              {presets.map(p => (
                <button
                  key={p.id}
                  onClick={() => dispatch(applyPreset(p))}
                  disabled={p.tier === 'premium' && userTier !== 'premium'}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs border transition-all ${
                    p.tier === 'premium' && userTier !== 'premium'
                      ? 'border-gray-800 text-gray-600 cursor-not-allowed'
                      : 'border-gray-700 text-gray-300 hover:border-emerald-500/50 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{p.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full uppercase font-bold ${TIER_COLORS[p.tier]}`}>
                      {p.tier}
                    </span>
                  </div>
                  <div className="text-gray-600 text-xs mt-0.5">{p.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Sector */}
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Sector</div>
            <div className="flex flex-wrap gap-1">
              {SECTORS.map(s => (
                <button
                  key={s}
                  onClick={() => {
                    const cur = filters.sectors || []
                    const next = cur.includes(s) ? cur.filter(x => x !== s) : [...cur, s]
                    dispatch(setFilter({ key: 'sectors', value: next.length ? next : null }))
                  }}
                  className={`text-xs px-2 py-1 rounded-full transition-all border ${
                    (filters.sectors || []).includes(s)
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : 'text-gray-500 border-gray-700 hover:text-gray-300'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Price range */}
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Price Range (₹)</div>
            <div className="grid grid-cols-2 gap-2">
              <FilterInput label="Min" value={filters.min_price} onChange={v => dispatch(setFilter({ key: 'min_price', value: v }))} placeholder="0" />
              <FilterInput label="Max" value={filters.max_price} onChange={v => dispatch(setFilter({ key: 'max_price', value: v }))} placeholder="99999" />
            </div>
          </div>

          {/* Change % */}
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Change % Range</div>
            <div className="grid grid-cols-2 gap-2">
              <FilterInput label="Min %" value={filters.min_change_pct} onChange={v => dispatch(setFilter({ key: 'min_change_pct', value: v }))} placeholder="-10" />
              <FilterInput label="Max %" value={filters.max_change_pct} onChange={v => dispatch(setFilter({ key: 'max_change_pct', value: v }))} placeholder="10" />
            </div>
          </div>

          {/* VWAP */}
          <ToggleFilter
            label="Price vs VWAP"
            value={filters.above_vwap}
            onChange={v => dispatch(setFilter({ key: 'above_vwap', value: v }))}
          />

          {/* Volume Ratio */}
          <FilterInput
            label="Min Volume Ratio (vs 20D avg)"
            value={filters.min_volume_ratio}
            onChange={v => dispatch(setFilter({ key: 'min_volume_ratio', value: v }))}
            placeholder="e.g. 2.0"
          />

          {/* Signal types */}
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Signal Types</div>
            <div className="space-y-1">
              {SIGNAL_TYPES.map(st => (
                <label key={st.value} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={(filters.signal_types || []).includes(st.value)}
                    onChange={e => {
                      const cur = filters.signal_types || []
                      const next = e.target.checked ? [...cur, st.value] : cur.filter(x => x !== st.value)
                      dispatch(setFilter({ key: 'signal_types', value: next.length ? next : null }))
                    }}
                    className="accent-emerald-500"
                  />
                  <span className="text-xs text-gray-400 group-hover:text-gray-200 transition-colors">{st.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Sort By</div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={filters.sort_by}
                onChange={e => dispatch(setFilter({ key: 'sort_by', value: e.target.value }))}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="change_pct">Change %</option>
                <option value="volume">Volume</option>
                <option value="ltp">Price</option>
                <option value="oi">Open Interest</option>
              </select>
              <select
                value={filters.sort_dir}
                onChange={e => dispatch(setFilter({ key: 'sort_dir', value: e.target.value }))}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
          </div>
        </div>

        {/* Run button */}
        <div className="p-4 border-t border-gray-800">
          <button
            onClick={handleRun}
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-3 rounded-xl transition-all text-sm tracking-wide"
          >
            {loading ? 'Scanning...' : '⊞  Run Screener'}
          </button>
          {lastRun && (
            <div className="text-xs text-gray-600 text-center mt-2">
              Last run: {new Date(lastRun).toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 flex flex-col bg-gray-950 min-w-0">
        <div className="px-5 py-3 border-b border-gray-800 bg-gray-900 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">
            Results <span className="text-gray-500 font-normal">({results.length} stocks)</span>
          </h2>
          {error && <span className="text-xs text-red-400">{error}</span>}
        </div>

        <div className="flex-1 overflow-auto">
          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-600 space-y-3">
              <span className="text-4xl opacity-20">⊞</span>
              <span className="text-sm">Set filters and run the screener</span>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-900/95 backdrop-blur-sm">
                <tr className="border-b border-gray-800">
                  {['#', 'Symbol', 'Sector', 'LTP', 'Chg %', 'Volume', 'VWAP', 'OI', 'Signal', 'Confidence'].map(h => (
                    <th key={h} className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/40">
                {results.map(r => (
                  <tr key={r.symbol} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-600">{r.rank}</td>
                    <td className="px-4 py-3 font-bold text-white text-xs">{r.symbol}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{r.sector}</td>
                    <td className="px-4 py-3 font-mono text-sm">₹{r.ltp?.toFixed(2)}</td>
                    <td className={`px-4 py-3 font-mono font-bold text-sm ${r.change_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {r.change_pct >= 0 ? '+' : ''}{r.change_pct?.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-300">{(r.volume/1e5).toFixed(1)}L</td>
                    <td className={`px-4 py-3 font-mono text-xs ${r.ltp > r.vwap ? 'text-emerald-400' : 'text-red-400'}`}>
                      ₹{r.vwap?.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{(r.oi/1e5).toFixed(1)}L</td>
                    <td className="px-4 py-3">
                      {r.signal_label
                        ? <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">{r.signal_label}</span>
                        : <span className="text-gray-700 text-xs">—</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      {r.confidence
                        ? <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 bg-gray-800 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${r.confidence * 100}%` }} />
                            </div>
                            <span className="text-xs text-gray-500">{Math.round(r.confidence * 100)}%</span>
                          </div>
                        : <span className="text-gray-700 text-xs">—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
