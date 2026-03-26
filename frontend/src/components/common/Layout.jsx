// TradeFinder — App Layout with sidebar
import React from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { logout } from '../../store/authSlice'
import { selectWsStatus } from '../../store/marketSlice'
import { useWebSocket } from '../../hooks/useWebSocket'
import MarketClock from './MarketClock'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard',    icon: '◈' },
  { to: '/screener',  label: 'Screener',     icon: '⊞' },
  { to: '/signals',   label: 'Signals',      icon: '⚡' },
  { to: '/backtest',  label: 'Backtest',     icon: '↺'  },
]

export default function Layout() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { status } = useWebSocket()
  const user = useSelector(s => s.auth.user)

  const wsColor = { connected: '#22c55e', connecting: '#f59e0b', disconnected: '#ef4444', error: '#ef4444' }[status] || '#6b7280'

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 font-mono overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex flex-col bg-gray-900 border-r border-gray-800 shrink-0">
        {/* Logo */}
        <div className="px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 text-xl">▲</span>
            <span className="text-white font-bold tracking-widest text-sm">TRADE<span className="text-emerald-400">FINDER</span></span>
          </div>
          <MarketClock />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'
                }`
              }
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom: WS status + user */}
        <div className="px-4 py-4 border-t border-gray-800 space-y-3">
          {/* WS Status */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="relative flex h-2 w-2">
              <span
                className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                style={{ backgroundColor: wsColor }}
              />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: wsColor }} />
            </span>
            Live feed {status}
          </div>

          {/* User tier badge */}
          {user && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 truncate">{user.email}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase ${
                user.tier === 'premium' ? 'bg-amber-500/20 text-amber-400' :
                user.tier === 'basic'   ? 'bg-blue-500/20 text-blue-400' :
                                          'bg-gray-700 text-gray-400'
              }`}>
                {user.tier}
              </span>
            </div>
          )}

          <button
            onClick={() => { dispatch(logout()); navigate('/login') }}
            className="w-full text-xs text-gray-500 hover:text-red-400 text-left transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
