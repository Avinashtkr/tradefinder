// TradeFinder — WebSocket hook with auto-reconnect
import { useEffect, useRef, useCallback, useState } from 'react'
import { useDispatch } from 'react-redux'
import { updateQuote, addSignal } from '../store/marketSlice'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws'
const RECONNECT_DELAY = 3000
const MAX_RECONNECT_ATTEMPTS = 10

export function useWebSocket() {
  const dispatch = useDispatch()
  const wsRef = useRef(null)
  const reconnectTimer = useRef(null)
  const reconnectAttempts = useRef(0)
  const [status, setStatus] = useState('disconnected')  // connecting|connected|disconnected|error

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const token = localStorage.getItem('access_token')
    const url = token ? `${WS_URL}?token=${token}` : WS_URL

    setStatus('connecting')
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setStatus('connected')
      reconnectAttempts.current = 0
      // Subscribe to broadcast channel
      ws.send(JSON.stringify({ action: 'subscribe', channel: 'broadcast' }))
    }

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data)
        switch (msg.type) {
          case 'tick':
            dispatch(updateQuote(msg.data))
            break
          case 'signal':
            dispatch(addSignal(msg.data))
            break
          case 'connected':
            console.log('[WS] Connected:', msg.data.message)
            break
          default:
            break
        }
      } catch (e) {
        console.warn('[WS] Parse error:', e)
      }
    }

    ws.onerror = () => setStatus('error')

    ws.onclose = () => {
      setStatus('disconnected')
      if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts.current++
        reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY)
      }
    }
  }, [dispatch])

  const disconnect = useCallback(() => {
    clearTimeout(reconnectTimer.current)
    wsRef.current?.close()
    setStatus('disconnected')
  }, [])

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  useEffect(() => {
    connect()
    // Heartbeat ping every 30s
    const pingInterval = setInterval(() => send({ action: 'ping' }), 30_000)
    return () => {
      clearInterval(pingInterval)
      disconnect()
    }
  }, [connect, disconnect, send])

  return { status, send }
}
