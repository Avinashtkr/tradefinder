// TradeFinder — Redux market slice
import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  quotes: {},          // { "RELIANCE": { symbol, ltp, change_pct, ... } }
  signals: [],         // latest 200 signals, newest first
  sectorData: {},      // { "IT": { avg_change: 1.2, stocks: 8, ... } }
  topGainers: [],
  topLosers: [],
  wsStatus: 'disconnected',
  lastUpdated: null,
}

const marketSlice = createSlice({
  name: 'market',
  initialState,
  reducers: {
    updateQuote(state, action) {
      const q = action.payload
      state.quotes[q.symbol] = {
        ...state.quotes[q.symbol],
        ...q,
        _flash: true,           // triggers cell flash animation
      }
      state.lastUpdated = Date.now()

      // Recompute sector aggregates
      const sectors = {}
      Object.values(state.quotes).forEach(quote => {
        const sector = quote.sector || 'Other'
        if (!sectors[sector]) sectors[sector] = { total_change: 0, count: 0, stocks: [] }
        sectors[sector].total_change += quote.change_pct || 0
        sectors[sector].count++
        sectors[sector].stocks.push(quote.symbol)
      })
      Object.keys(sectors).forEach(sector => {
        sectors[sector].avg_change = sectors[sector].total_change / sectors[sector].count
      })
      state.sectorData = sectors

      // Top gainers / losers
      const sorted = Object.values(state.quotes).sort((a, b) => (b.change_pct || 0) - (a.change_pct || 0))
      state.topGainers = sorted.slice(0, 10)
      state.topLosers  = sorted.slice(-10).reverse()
    },

    addSignal(state, action) {
      const sig = action.payload
      // Deduplicate by symbol + type within last 5 minutes
      const fiveMinAgo = Date.now() - 5 * 60 * 1000
      const exists = state.signals.some(
        s => s.symbol === sig.symbol &&
             s.signal_type === sig.signal_type &&
             new Date(s.generated_at).getTime() > fiveMinAgo
      )
      if (!exists) {
        state.signals = [{ ...sig, id: `${sig.symbol}_${sig.signal_type}_${Date.now()}` }, ...state.signals].slice(0, 200)
      }
    },

    setWsStatus(state, action) {
      state.wsStatus = action.payload
    },

    clearFlash(state, action) {
      const symbol = action.payload
      if (state.quotes[symbol]) state.quotes[symbol]._flash = false
    },
  },
})

export const { updateQuote, addSignal, setWsStatus, clearFlash } = marketSlice.actions
export default marketSlice.reducer

// Selectors
export const selectAllQuotes = state => Object.values(state.market.quotes)
export const selectQuote = symbol => state => state.market.quotes[symbol]
export const selectSignals = state => state.market.signals
export const selectSectors = state => state.market.sectorData
export const selectTopGainers = state => state.market.topGainers
export const selectTopLosers  = state => state.market.topLosers
export const selectWsStatus   = state => state.market.wsStatus
