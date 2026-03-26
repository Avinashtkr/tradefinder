// TradeFinder — Register Page
import React, { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, Link } from 'react-router-dom'
import { registerThunk, clearError } from '../store/authSlice'

export default function Register() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { loading, error, isAuthenticated } = useSelector(s => s.auth)
  const [form, setForm] = useState({ email: '', password: '', full_name: '', phone: '' })
  const [pwError, setPwError] = useState('')

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard')
    return () => dispatch(clearError())
  }, [isAuthenticated, navigate, dispatch])

  const handleSubmit = async e => {
    e.preventDefault()
    if (form.password.length < 8) { setPwError('Password must be at least 8 characters'); return }
    setPwError('')
    const result = await dispatch(registerThunk(form))
    if (registerThunk.fulfilled.match(result)) navigate('/dashboard')
  }

  const update = field => e => setForm(f => ({ ...f, [field]: e.target.value }))

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(34,197,94,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(34,197,94,0.03)_1px,transparent_1px)] bg-[size:40px_40px]" />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="text-emerald-400 text-3xl">▲</span>
            <span className="text-white font-bold tracking-widest text-2xl">TRADE<span className="text-emerald-400">FINDER</span></span>
          </div>
          <p className="text-gray-500 text-sm">Create your free account</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <h2 className="text-lg font-bold text-white mb-6">Create Account</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { field: 'full_name', label: 'Full Name', type: 'text', placeholder: 'Rahul Sharma' },
              { field: 'email',    label: 'Email',     type: 'email', placeholder: 'rahul@example.com' },
              { field: 'phone',    label: 'Phone',     type: 'tel',  placeholder: '+91 98765 43210' },
            ].map(({ field, label, type, placeholder }) => (
              <div key={field}>
                <label className="block text-xs text-gray-400 mb-1.5">{label}</label>
                <input
                  type={type}
                  required={field !== 'phone'}
                  value={form[field]}
                  onChange={update(field)}
                  placeholder={placeholder}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                />
              </div>
            ))}

            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Password</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={update('password')}
                placeholder="Min 8 characters"
                className={`w-full bg-gray-800 border rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 transition-all ${
                  pwError ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30' : 'border-gray-700 focus:border-emerald-500 focus:ring-emerald-500/30'
                }`}
              />
              {pwError && <p className="text-xs text-red-400 mt-1">{pwError}</p>}
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-3.5 rounded-xl transition-all text-sm tracking-wide mt-2"
            >
              {loading ? 'Creating account...' : 'Create Free Account →'}
            </button>
          </form>

          {/* Free tier features */}
          <div className="mt-5 pt-5 border-t border-gray-800">
            <p className="text-xs text-gray-600 mb-3">Free account includes:</p>
            <div className="space-y-1">
              {['Live market feed (NSE/BSE)', 'Basic signal alerts', 'Sector heatmap', 'Top gainers/losers'].map(f => (
                <div key={f} className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="text-emerald-500">✓</span> {f}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 text-center">
            <p className="text-sm text-gray-500">
              Already have an account?{' '}
              <Link to="/login" className="text-emerald-400 hover:text-emerald-300 transition-colors">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
