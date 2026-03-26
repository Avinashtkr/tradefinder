// TradeFinder — useAuth hook
import { useSelector, useDispatch } from 'react-redux'
import { logout } from '../store/authSlice'

export function useAuth() {
  const { user, isAuthenticated, loading, error } = useSelector(s => s.auth)
  const dispatch = useDispatch()

  const signOut = () => dispatch(logout())

  const hasFeature = (feature) => {
    const tier = user?.tier || 'free'
    const featureMap = {
      screener_presets: ['basic', 'premium'],
      advanced_filters: ['basic', 'premium'],
      backtest: ['basic', 'premium'],
      premium_strategies: ['premium'],
      option_chain: ['premium'],
      api_access: ['premium'],
    }
    return featureMap[feature]?.includes(tier) ?? false
  }

  return { user, isAuthenticated, loading, error, signOut, hasFeature }
}
