// TradeFinder — Sector Heatmap
import React, { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { selectSectors } from '../../store/marketSlice'

function interpolateColor(value, min, max) {
  // Negative = red, zero = neutral gray, positive = green
  if (value >= 0) {
    const t = Math.min(value / (max || 3), 1)
    const g = Math.round(68 + t * (187))
    const r = Math.round(55 - t * 40)
    const b = Math.round(60 - t * 40)
    return `rgb(${r},${g},${b})`
  } else {
    const t = Math.min(Math.abs(value) / (Math.abs(min) || 3), 1)
    const r = Math.round(55 + t * 187)
    const g = Math.round(68 - t * 40)
    const b = Math.round(60 - t * 40)
    return `rgb(${r},${g},${b})`
  }
}

function textColorFor(bg) {
  return '#fff'
}

export default function SectorHeatmap() {
  const sectors = useSelector(selectSectors)

  const entries = useMemo(() => {
    return Object.entries(sectors)
      .map(([name, data]) => ({
        name,
        change: data.avg_change || 0,
        count: data.count || 0,
        stocks: data.stocks || [],
      }))
      .sort((a, b) => b.change - a.change)
  }, [sectors])

  if (entries.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-600 text-sm">
        Awaiting sector data...
      </div>
    )
  }

  const values = entries.map(e => e.change)
  const max = Math.max(...values)
  const min = Math.min(...values)

  return (
    <div className="p-3 h-full">
      <div className="grid grid-cols-3 gap-2 h-full auto-rows-fr">
        {entries.map(entry => {
          const bg = interpolateColor(entry.change, min, max)
          const size = Math.max(0.6, Math.min(1.1, 0.6 + entry.count / 20))
          return (
            <div
              key={entry.name}
              className="rounded-lg p-2 flex flex-col justify-between cursor-pointer transition-transform hover:scale-105 hover:z-10 relative"
              style={{ backgroundColor: bg, transform: `scale(${size})` }}
              title={`${entry.name}: ${entry.change >= 0 ? '+' : ''}${entry.change.toFixed(2)}% | ${entry.count} stocks`}
            >
              <div className="text-white text-xs font-bold truncate">{entry.name}</div>
              <div className="flex items-end justify-between">
                <span className="text-white/70 text-xs">{entry.count} stocks</span>
                <span className="text-white font-mono font-bold text-sm">
                  {entry.change >= 0 ? '+' : ''}{entry.change.toFixed(2)}%
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
