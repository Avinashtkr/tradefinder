// TradeFinder — Redux store
import { configureStore } from '@reduxjs/toolkit'
import marketReducer from './marketSlice'
import authReducer from './authSlice'
import screenerReducer from './screenerSlice'

export const store = configureStore({
  reducer: {
    market: marketReducer,
    auth: authReducer,
    screener: screenerReducer,
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActionPaths: ['payload.timestamp'],
      },
    }),
})
