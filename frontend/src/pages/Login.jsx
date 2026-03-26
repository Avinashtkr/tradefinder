// TradeFinder — Login Page
import React, { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, Link } from 'react-router-dom'
import { loginThunk, clearError } from '../store/authSlice'

export default function Login() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { loading, error, isAuthenticated } = useSelector(s => s.auth)
  const [form, setForm] = useState({ email: '', password: '' })

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard')
    return () => dispatch(clearError())
  }, [isAuthenticated, navigate, dispatch])

  const handleSubmit = async e => {
    e.preventDefault()
    const result = await dispatch(loginThunk(form))
    if (loginThunk.fulfilled.match(result)) navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      {/* Background grid effect */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(34,197,94,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(34,197,94,0.03)_1px,transparent_1px)] bg-[size:40px_40px]" />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="text-emerald-400 text-3xl">▲</span>
            <span className="text-white font-bold tracking-widest text-2xl">TRADE<span className="text-emerald-400">FINDER</span></span>
          </div>
          <p className="text-gray-500 text-sm">Real-time Indian stock market scanner</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <h2 className="text-lg font-bold text-white mb-6">Sign In</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="you@example.com"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Password</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-3.5 rounded-xl transition-all text-sm tracking-wide mt-2"
            >
              {loading ? 'Signing in...' : 'Sign In →'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-800 text-center">
            <p className="text-sm text-gray-500">
              No account?{' '}
              <Link to="/register" className="text-emerald-400 hover:text-emerald-300 transition-colors">
                Create one free
              </Link>
            </p>
          </div>
        </div>

        {/* Feature bullets */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            { icon: '⚡', label: 'Live Signals' },
            { icon: '◈',  label: 'ORB Scanner' },
            { icon: '⊞',  label: 'OI Analysis' },
          ].map(f => (
            <div key={f.label} className="bg-gray-900/50 border border-gray-800 rounded-xl p-3 text-center">
              <div className="text-lg mb-1">{f.icon}</div>
              <div className="text-xs text-gray-500">{f.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
