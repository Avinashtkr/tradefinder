// TradeFinder — Live Signal Feed Panel
import React, { useRef, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { selectSignals } from '../../store/marketSlice'

const SIGNAL_STYLES = {
  bullish_breakout:  { icon: '▲', color: 'text-emerald-400', border: 'border-emerald-500/40', bg: 'bg-emerald-500/5'  },
  bearish_breakdown: { icon: '▼', color: 'text-red-400',     border: 'border-red-500/40',     bg: 'bg-red-500/5'      },
  volume_surge:      { icon: '⚡', color: 'text-amber-400',   border: 'border-amber-500/40',   bg: 'bg-amber-500/5'    },
  oi_buildup_long:   { icon: '◆', color: 'text-blue-400',    border: 'border-blue-500/40',    bg: 'bg-blue-500/5'     },
  oi_buildup_short:  { icon: '◇', color: 'text-pink-400',    border: 'border-pink-500/40',    bg: 'bg-pink-500/5'     },
  vwap_reclaim:      { icon: '↑', color: 'text-cyan-400',    border: 'border-cyan-500/40',    bg: 'bg-cyan-500/5'     },
  rsi_breakout:      { icon: '◉', color: 'text-violet-400',  border: 'border-violet-500/40',  bg: 'bg-violet-500/5'   },
}

const LABELS = {
  bullish_breakout:  'Bullish Breakout',
  bearish_breakdown: 'Bearish Breakdown',
  volume_surge:      'Volume Surge',
  oi_buildup_long:   'Long Buildup',
  oi_buildup_short:  'Short Buildup',
  vwap_reclaim:      'VWAP Reclaim',
  rsi_breakout:      'RSI Breakout',
}

function ConfidenceBar({ value }) {
  const pct = Math.round((value || 0) * 100)
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-gray-600'
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1 w-16 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500">{pct}%</span>
    </div>
  )
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

export default function SignalFeed({ maxItems = 50 }) {
  const signals = useSelector(selectSignals)
  const scrollRef = useRef(null)
  const prevLenRef = useRef(0)

  // Auto-scroll when new signals arrive
  useEffect(() => {
    if (signals.length > prevLenRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
    prevLenRef.current = signals.length
  }, [signals.length])

  const visible = signals.slice(0, maxItems)

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Live Signals</span>
          {signals.length > 0 && (
            <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2 py-0.5 rounded-full font-mono">
              {signals.length}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-600">Real-time</span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {visible.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-gray-600 text-sm space-y-2">
            <span className="text-2xl opacity-30">⚡</span>
            <span>Signals appear when market opens</span>
          </div>
        )}
        {visible.map(sig => {
          const style = SIGNAL_STYLES[sig.signal_type] || { icon: '●', color: 'text-gray-400', border: 'border-gray-700', bg: 'bg-gray-800/30' }
          return (
            <div
              key={sig.id || `${sig.symbol}_${sig.generated_at}`}
              className={`rounded-lg p-3 border ${style.border} ${style.bg} transition-all hover:brightness-110`}
            >
              <div className="flex items-start justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className={`text-base ${style.color}`}>{style.icon}</span>
                  <div>
                    <span className="font-bold text-white text-sm">{sig.symbol}</span>
                    <span className="text-gray-500 text-xs ml-1">{sig.exchange}</span>
                  </div>
                </div>
                <span className="text-xs text-gray-600">{timeAgo(sig.generated_at)}</span>
              </div>

              <div className={`text-xs font-semibold mb-1.5 ${style.color}`}>
                {LABELS[sig.signal_type] || sig.signal_type}
              </div>

              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-gray-400 space-x-2">
                  <span>₹{sig.trigger_price?.toFixed(2)}</span>
                  {sig.target_price && <span className="text-emerald-400">T: ₹{sig.target_price?.toFixed(2)}</span>}
                  {sig.stop_loss && <span className="text-red-400">SL: ₹{sig.stop_loss?.toFixed(2)}</span>}
                </div>
              </div>

              <ConfidenceBar value={sig.confidence} />

              {sig.metadata && Object.keys(sig.metadata).length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                  {sig.metadata.vol_ratio && (
                    <span className="text-xs text-gray-600">Vol: {sig.metadata.vol_ratio}x</span>
                  )}
                  {sig.metadata.change_pct != null && (
                    <span className={`text-xs ${sig.metadata.change_pct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {sig.metadata.change_pct >= 0 ? '+' : ''}{sig.metadata.change_pct}%
                    </span>
                  )}
                  {sig.metadata.rsi && (
                    <span className="text-xs text-gray-600">RSI: {sig.metadata.rsi}</span>
                  )}
                  {sig.metadata.pcr && (
                    <span className="text-xs text-gray-600">PCR: {sig.metadata.pcr}</span>
                  )}
                </div>
              )}

              {sig.sector && (
                <div className="mt-1 text-xs text-gray-700">{sig.sector}</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
