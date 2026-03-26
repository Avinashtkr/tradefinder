// TradeFinder — Dashboard Page
import React, { useState } from 'react'
import { useSelector } from 'react-redux'
import { selectTopGainers, selectTopLosers, selectSignals } from '../store/marketSlice'
import LiveStockTable from '../components/dashboard/LiveStockTable'
import SignalFeed from '../components/dashboard/SignalFeed'
import SectorHeatmap from '../components/dashboard/SectorHeatmap'
import TradingViewWidget from '../components/charts/TradingViewWidget'

function StatCard({ label, value, sub, color = 'text-white' }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
      {sub && <div className="text-xs text-gray-600 mt-0.5">{sub}</div>}
    </div>
  )
}

function MiniTicker({ stocks, direction }) {
  return (
    <div className="space-y-1">
      {stocks.slice(0, 5).map(s => (
        <div key={s.symbol} className="flex items-center justify-between text-xs py-1 border-b border-gray-800/50">
          <span className="font-semibold text-gray-300 w-20 truncate">{s.symbol}</span>
          <span className="font-mono text-gray-400">₹{s.ltp?.toFixed(2)}</span>
          <span className={`font-mono font-bold ${direction === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>
            {s.change_pct >= 0 ? '+' : ''}{s.change_pct?.toFixed(2)}%
          </span>
        </div>
      ))}
    </div>
  )
}

const VIEWS = ['Table', 'Heatmap', 'Chart']

export default function Dashboard() {
  const gainers = useSelector(selectTopGainers)
  const losers = useSelector(selectTopLosers)
  const signals = useSelector(selectSignals)
  const quotes = useSelector(s => Object.values(s.market.quotes))
  const [activeView, setActiveView] = useState('Table')
  const [selectedSymbol, setSelectedSymbol] = useState('RELIANCE')

  const bullishCount = signals.filter(s => ['bullish_breakout', 'vwap_reclaim', 'oi_buildup_long'].includes(s.signal_type)).length
  const bearishCount = signals.filter(s => ['bearish_breakdown', 'oi_buildup_short'].includes(s.signal_type)).length
  const activeStocks = quotes.filter(q => q.ltp).length

  return (
    <div className="flex h-full">
      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header bar */}
        <div className="bg-gray-900 border-b border-gray-800 px-5 py-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-base font-bold text-white tracking-wide">Market Dashboard</h1>
            {/* View toggles */}
            <div className="flex items-center gap-1 bg-gray-800 p-1 rounded-lg">
              {VIEWS.map(v => (
                <button
                  key={v}
                  onClick={() => setActiveView(v)}
                  className={`text-xs px-3 py-1.5 rounded-md transition-all ${
                    activeView === v ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3">
            <StatCard label="Active Stocks" value={activeStocks} sub="NSE/BSE" />
            <StatCard label="Signals Today" value={signals.length} sub="All types" />
            <StatCard label="Bullish Signals" value={bullishCount} color="text-emerald-400" sub="Breakouts + OI" />
            <StatCard label="Bearish Signals" value={bearishCount} color="text-red-400" sub="Breakdowns" />
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 overflow-hidden bg-gray-950">
          {activeView === 'Table' && (
            <LiveStockTable />
          )}
          {activeView === 'Heatmap' && (
            <SectorHeatmap />
          )}
          {activeView === 'Chart' && (
            <div className="h-full flex flex-col">
              <div className="px-4 py-2 flex gap-2 flex-wrap border-b border-gray-800">
                {['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN'].map(sym => (
                  <button
                    key={sym}
                    onClick={() => setSelectedSymbol(sym)}
                    className={`text-xs px-3 py-1.5 rounded-lg transition-all ${
                      selectedSymbol === sym
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'text-gray-500 hover:text-gray-300 bg-gray-800'
                    }`}
                  >
                    {sym}
                  </button>
                ))}
              </div>
              <TradingViewWidget symbol={`NSE:${selectedSymbol}`} />
            </div>
          )}
        </div>
      </div>

      {/* Right panel: Signals + Gainers/Losers */}
      <div className="w-80 flex flex-col border-l border-gray-800 bg-gray-900 shrink-0">
        {/* Signal feed - top half */}
        <div className="flex-1 overflow-hidden border-b border-gray-800">
          <SignalFeed maxItems={30} />
        </div>

        {/* Gainers/Losers - bottom half */}
        <div className="h-64 overflow-hidden">
          <div className="grid grid-cols-2 h-full divide-x divide-gray-800">
            <div className="p-3">
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">Top Gainers</div>
              <MiniTicker stocks={gainers} direction="up" />
            </div>
            <div className="p-3">
              <div className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2">Top Losers</div>
              <MiniTicker stocks={losers} direction="down" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
