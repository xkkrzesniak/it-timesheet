import { useMsal } from '@azure/msal-react'
import { useCallback } from 'react'
import { loginRequest } from './msalConfig'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/api/client'

export function useAuth() {
  const { instance, accounts } = useMsal()
  const { user, token, setAuth, clearAuth } = useAuthStore()

  const login = useCallback(async () => {
    try {
      const result = await instance.loginPopup(loginRequest)
      const azureToken = result.idToken

      // Wymień token Azure na własny JWT
      const { data } = await api.post<{ token: string; user: NonNullable<typeof user> }>('/auth/azure', {
        azureToken,
      })
      setAuth(data.token, data.user)
      return data.user
    } catch (err) {
      console.error('Login failed', err)
      throw err
    }
  }, [instance, setAuth])

  const logout = useCallback(async () => {
    clearAuth()
    await instance.logoutPopup({ account: accounts[0] ?? null })
  }, [instance, accounts, clearAuth])

  return { user, token, isAuthenticated: !!token, login, logout }
}
