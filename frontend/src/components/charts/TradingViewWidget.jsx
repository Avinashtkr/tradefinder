// TradeFinder — TradingView Chart Widget
import { useEffect, useRef } from 'react'

export default function TradingViewWidget({ symbol = 'NSE:RELIANCE', interval = '5', height = '100%' }) {
  const containerRef = useRef(null)
  const widgetRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Clean up previous widget
    containerRef.current.innerHTML = ''

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval,
      timezone: 'Asia/Kolkata',
      theme: 'dark',
      style: '1',
      locale: 'en',
      enable_publishing: false,
      backgroundColor: 'rgba(9, 11, 15, 1)',
      gridColor: 'rgba(255, 255, 255, 0.03)',
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      calendar: false,
      hide_volume: false,
      support_host: 'https://www.tradingview.com',
      studies: ['RSI@tv-basicstudies', 'VWAP@tv-basicstudies', 'Volume@tv-basicstudies'],
    })

    const container = document.createElement('div')
    container.className = 'tradingview-widget-container'
    container.style.height = '100%'
    container.style.width = '100%'

    const innerDiv = document.createElement('div')
    innerDiv.className = 'tradingview-widget-container__widget'
    innerDiv.style.height = 'calc(100% - 32px)'
    innerDiv.style.width = '100%'

    container.appendChild(innerDiv)
    container.appendChild(script)
    containerRef.current.appendChild(container)
    widgetRef.current = container

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = ''
    }
  }, [symbol, interval])

  return (
    <div ref={containerRef} className="flex-1 bg-gray-950" style={{ minHeight: 400 }} />
  )
}
