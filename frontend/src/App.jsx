// TradeFinder — React App Entry Point
import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Provider } from 'react-redux'
import { store } from './store'
import { useAuth } from './hooks/useAuth'

import Dashboard from './pages/Dashboard'
import Screener from './pages/Screener'
import Signals from './pages/Signals'
import Backtest from './pages/Backtest'
import Login from './pages/Login'
import Register from './pages/Register'
import Layout from './components/common/Layout'

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="screener" element={<Screener />} />
            <Route path="signals" element={<Signals />} />
            <Route path="backtest" element={<Backtest />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </Provider>
  )
}

export default App
