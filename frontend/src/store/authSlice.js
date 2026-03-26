// TradeFinder — Auth Redux slice
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../services/api'

export const loginThunk = createAsyncThunk('auth/login', async (credentials, { rejectWithValue }) => {
  try {
    const res = await api.post('/auth/login', credentials)
    return res.data
  } catch (err) {
    return rejectWithValue(err.response?.data?.detail || 'Login failed')
  }
})

export const registerThunk = createAsyncThunk('auth/register', async (data, { rejectWithValue }) => {
  try {
    const res = await api.post('/auth/register', data)
    return res.data
  } catch (err) {
    return rejectWithValue(err.response?.data?.detail || 'Registration failed')
  }
})

const initialState = {
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  access_token: localStorage.getItem('access_token') || null,
  refresh_token: localStorage.getItem('refresh_token') || null,
  isAuthenticated: !!localStorage.getItem('access_token'),
  loading: false,
  error: null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.user = null
      state.access_token = null
      state.refresh_token = null
      state.isAuthenticated = false
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('user')
    },
    clearError(state) { state.error = null },
  },
  extraReducers: builder => {
    builder
      .addCase(loginThunk.pending, state => { state.loading = true; state.error = null })
      .addCase(loginThunk.fulfilled, (state, { payload }) => {
        state.loading = false
        state.isAuthenticated = true
        state.access_token = payload.access_token
        state.refresh_token = payload.refresh_token
        state.user = { id: payload.user_id, email: payload.email, tier: payload.subscription_tier }
        localStorage.setItem('access_token', payload.access_token)
        localStorage.setItem('refresh_token', payload.refresh_token)
        localStorage.setItem('user', JSON.stringify(state.user))
      })
      .addCase(loginThunk.rejected, (state, { payload }) => {
        state.loading = false
        state.error = payload
      })
      .addCase(registerThunk.pending, state => { state.loading = true; state.error = null })
      .addCase(registerThunk.fulfilled, (state, { payload }) => {
        state.loading = false
        state.isAuthenticated = true
        state.access_token = payload.access_token
        state.refresh_token = payload.refresh_token
        state.user = { id: payload.user_id, email: payload.email, tier: payload.subscription_tier }
        localStorage.setItem('access_token', payload.access_token)
        localStorage.setItem('refresh_token', payload.refresh_token)
        localStorage.setItem('user', JSON.stringify(state.user))
      })
      .addCase(registerThunk.rejected, (state, { payload }) => {
        state.loading = false
        state.error = payload
      })
  }
})

export const { logout, clearError } = authSlice.actions
export default authSlice.reducer
