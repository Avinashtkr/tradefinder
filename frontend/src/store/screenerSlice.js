// TradeFinder — Screener Redux slice
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../services/api'

export const runScreener = createAsyncThunk('screener/run', async (filters, { rejectWithValue }) => {
  try {
    const res = await api.post('/screener/run', filters)
    return res.data
  } catch (err) {
    return rejectWithValue(err.response?.data?.detail || 'Screener failed')
  }
})

export const loadPresets = createAsyncThunk('screener/presets', async () => {
  const res = await api.get('/screener/presets')
  return res.data
})

const screenerSlice = createSlice({
  name: 'screener',
  initialState: {
    results: [],
    presets: [],
    filters: {
      sectors: null,
      min_price: null,
      max_price: null,
      min_volume_ratio: null,
      min_change_pct: null,
      max_change_pct: null,
      above_vwap: null,
      signal_types: null,
      sort_by: 'change_pct',
      sort_dir: 'desc',
      limit: 50,
      offset: 0,
    },
    loading: false,
    error: null,
    lastRun: null,
  },
  reducers: {
    setFilter(state, { payload: { key, value } }) {
      state.filters[key] = value
    },
    applyPreset(state, { payload: preset }) {
      state.filters = { ...state.filters, ...preset.filters }
    },
    resetFilters(state) {
      state.filters = {
        sectors: null, min_price: null, max_price: null,
        min_volume_ratio: null, min_change_pct: null,
        max_change_pct: null, above_vwap: null,
        signal_types: null, sort_by: 'change_pct',
        sort_dir: 'desc', limit: 50, offset: 0,
      }
    },
  },
  extraReducers: builder => {
    builder
      .addCase(runScreener.pending, state => { state.loading = true; state.error = null })
      .addCase(runScreener.fulfilled, (state, { payload }) => {
        state.loading = false
        state.results = payload
        state.lastRun = Date.now()
      })
      .addCase(runScreener.rejected, (state, { payload }) => {
        state.loading = false
        state.error = payload
      })
      .addCase(loadPresets.fulfilled, (state, { payload }) => {
        state.presets = payload
      })
  },
})

export const { setFilter, applyPreset, resetFilters } = screenerSlice.actions
export default screenerSlice.reducer
