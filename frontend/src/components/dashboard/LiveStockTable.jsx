// TradeFinder — Live Stock Table with flash cells
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { selectAllQuotes, clearFlash } from '../../store/marketSlice'

const COLUMNS = [
  { key: 'symbol',     label: 'Symbol',    sortable: true,  width: 'w-24'  },
  { key: 'sector',     label: 'Sector',    sortable: true,  width: 'w-28'  },
  { key: 'ltp',        label: 'LTP',       sortable: true,  width: 'w-24', align: 'right' },
  { key: 'change_pct', label: 'Chg %',     sortable: true,  width: 'w-20', align: 'right' },
  { key: 'volume',     label: 'Volume',    sortable: true,  width: 'w-28', align: 'right' },
  { key: 'oi',         label: 'OI',        sortable: true,  width: 'w-24', align: 'right' },
  { key: 'vwap',       label: 'VWAP',      sortable: true,  width: 'w-24', align: 'right' },
  { key: 'pcr',        label: 'PCR',       sortable: false, width: 'w-16', align: 'right' },
  { key: 'signal',     label: 'Signal',    sortable: false, width: 'w-36'  },
]

function formatVol(v) {
  if (!v) return '—'
  if (v >= 1e7) return (v / 1e7).toFixed(2) + ' Cr'
  if (v >= 1e5) return (v / 1e5).toFixed(2) + ' L'
  return v.toLocaleString('en-IN')
}

function formatPrice(v) {
  if (!v) return '—'
  return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function SignalBadge({ type, confidence }) {
  if (!type) return <span className="text-gray-600 text-xs">—</span>
  const configs = {
    bullish_breakout:  { label: 'Bullish BO',      bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
    bearish_breakdown: { label: 'Bearish BD',      bg: 'bg-red-500/20',     text: 'text-red-400'     },
    volume_surge:      { label: 'Vol Surge',       bg: 'bg-amber-500/20',   text: 'text-amber-400'   },
    oi_buildup_long:   { label: 'OI Long',         bg: 'bg-blue-500/20',    text: 'text-blue-400'    },
    oi_buildup_short:  { label: 'OI Short',        bg: 'bg-pink-500/20',    text: 'text-pink-400'    },
    vwap_reclaim:      { label: 'VWAP Reclaim',    bg: 'bg-cyan-500/20',    text: 'text-cyan-400'    },
    rsi_breakout:      { label: 'RSI Breakout',    bg: 'bg-violet-500/20',  text: 'text-violet-400'  },
    high_momentum:     { label: 'Momentum',        bg: 'bg-orange-500/20',  text: 'text-orange-400'  },
  }
  const cfg = configs[type] || { label: type, bg: 'bg-gray-700', text: 'text-gray-300' }
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.text}`}>
        {cfg.label}
      </span>
      {confidence && (
        <span className="text-xs text-gray-500">{Math.round(confidence * 100)}%</span>
      )}
    </div>
  )
}

function PriceCell({ value, prevValue, flash }) {
  const [animate, setAnimate] = useState('')
  useEffect(() => {
    if (!flash) return
    const dir = value > (prevValue || 0) ? 'up' : 'down'
    setAnimate(dir)
    const t = setTimeout(() => setAnimate(''), 600)
    return () => clearTimeout(t)
  }, [value, flash])

  const color = animate === 'up' ? 'text-emerald-400 bg-emerald-400/10' :
                animate === 'down' ? 'text-red-400 bg-red-400/10' : ''

  return (
    <span className={`font-mono tabular-nums transition-all duration-300 px-1 rounded ${color}`}>
      {formatPrice(value)}
    </span>
  )
}

export default function LiveStockTable({ filters = {} }) {
  const dispatch = useDispatch()
  const quotes = useSelector(selectAllQuotes)
  const signals = useSelector(s => s.market.signals)

  const [sortKey, setSortKey] = useState('change_pct')
  const [sortDir, setSortDir] = useState('desc')
  const [sectorFilter, setSectorFilter] = useState('All')

  // Map latest signal to each symbol
  const signalMap = useMemo(() => {
    const map = {}
    signals.forEach(sig => {
      if (!map[sig.symbol]) map[sig.symbol] = sig
    })
    return map
  }, [signals])

  const sectors = useMemo(() => {
    const s = new Set(quotes.map(q => q.sector || 'Other'))
    return ['All', ...Array.from(s).sort()]
  }, [quotes])

  const filtered = useMemo(() => {
    let rows = quotes.filter(q => q.symbol && q.ltp)
    if (sectorFilter !== 'All') rows = rows.filter(q => q.sector === sectorFilter)
    // Apply any external filters
    if (filters.above_vwap) rows = rows.filter(q => q.ltp > q.vwap)
    if (filters.min_change_pct != null) rows = rows.filter(q => q.change_pct >= filters.min_change_pct)
    if (filters.max_change_pct != null) rows = rows.filter(q => q.change_pct <= filters.max_change_pct)
    // Attach signal
    rows = rows.map(q => ({ ...q, _signal: signalMap[q.symbol] }))
    // Sort
    rows.sort((a, b) => {
      const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0
      return sortDir === 'desc' ? bv - av : av - bv
    })
    return rows
  }, [quotes, sectorFilter, filters, signalMap, sortKey, sortDir])

  const handleSort = key => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  // Clear flash after animation
  useEffect(() => {
    const flashing = quotes.filter(q => q._flash)
    if (flashing.length === 0) return
    const t = setTimeout(() => {
      flashing.forEach(q => dispatch(clearFlash(q.symbol)))
    }, 700)
    return () => clearTimeout(t)
  }, [quotes, dispatch])

  return (
    <div className="flex flex-col h-full">
      {/* Sector filter tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-800 overflow-x-auto scrollbar-none">
        <span className="text-xs text-gray-500 mr-2 whitespace-nowrap">Sector:</span>
        {sectors.map(sector => (
          <button
            key={sector}
            onClick={() => setSectorFilter(sector)}
            className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap transition-all ${
              sectorFilter === sector
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
            }`}
          >
            {sector}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-600 whitespace-nowrap">{filtered.length} stocks</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-900/95 backdrop-blur-sm z-10">
            <tr className="border-b border-gray-800">
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  className={`px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap ${col.width} ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.sortable ? 'cursor-pointer hover:text-gray-200 select-none' : ''}`}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    <span className="ml-1 text-emerald-400">{sortDir === 'desc' ? '↓' : '↑'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-12 text-gray-500 text-sm">
                  Waiting for live data...
                </td>
              </tr>
            )}
            {filtered.map(q => (
              <tr
                key={q.symbol}
                className={`group transition-colors hover:bg-gray-800/50 ${
                  q._signal ? 'border-l-2 border-emerald-500/50' : ''
                }`}
              >
                <td className="px-3 py-2 font-bold text-white text-xs tracking-wide">
                  {q.symbol}
                  <div className="text-gray-600 text-xs font-normal">{q.exchange}</div>
                </td>
                <td className="px-3 py-2 text-xs text-gray-400">{q.sector || '—'}</td>
                <td className="px-3 py-2 text-right font-mono">
                  <PriceCell value={q.ltp} flash={q._flash} />
                </td>
                <td className={`px-3 py-2 text-right font-mono font-semibold ${
                  (q.change_pct || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {(q.change_pct || 0) >= 0 ? '+' : ''}{(q.change_pct || 0).toFixed(2)}%
                </td>
                <td className="px-3 py-2 text-right text-gray-300 font-mono text-xs">
                  {formatVol(q.volume)}
                </td>
                <td className="px-3 py-2 text-right text-gray-400 font-mono text-xs">
                  {formatVol(q.oi)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs">
                  <span className={q.ltp > q.vwap ? 'text-emerald-400' : 'text-red-400'}>
                    {formatPrice(q.vwap)}
                  </span>
                </td>
                <td className={`px-3 py-2 text-right font-mono text-xs ${
                  (q.pcr || 0) > 1 ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {q.pcr ? q.pcr.toFixed(2) : '—'}
                </td>
                <td className="px-3 py-2">
                  {q._signal
                    ? <SignalBadge type={q._signal.signal_type} confidence={q._signal.confidence} />
                    : <span className="text-gray-700 text-xs">—</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
