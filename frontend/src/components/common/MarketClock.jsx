// TradeFinder — Live IST market clock
import { useState, useEffect } from 'react'

export default function MarketClock() {
  const [time, setTime] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
      const h = ist.getHours(), m = ist.getMinutes(), s = ist.getSeconds()
      const isMarketOpen = (h > 9 || (h === 9 && m >= 15)) && (h < 15 || (h === 15 && m <= 30))
      setIsOpen(isMarketOpen && [1, 2, 3, 4, 5].includes(ist.getDay()))
      setTime(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')} IST`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="mt-1.5">
      <div className="text-xs text-gray-500 font-mono">{time}</div>
      <div className={`text-xs font-bold mt-0.5 ${isOpen ? 'text-emerald-400' : 'text-red-400'}`}>
        {isOpen ? '● MARKET OPEN' : '○ MARKET CLOSED'}
      </div>
    </div>
  )
}
