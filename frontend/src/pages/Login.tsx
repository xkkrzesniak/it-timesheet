import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/ui/Button'

export function Login() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (isAuthenticated) {
    navigate('/track', { replace: true })
    return null
  }

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    try {
      await login()
      navigate('/track', { replace: true })
    } catch {
      setError('Logowanie nie powiodło się. Spróbuj ponownie.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text-primary">IT Timesheet</h1>
          <p className="text-text-muted text-sm mt-1">{import.meta.env.VITE_ORG_NAME}</p>
        </div>

        {/* Card */}
        <div className="bg-bg-card border border-border rounded-2xl p-8 shadow-2xl">
          <h2 className="text-lg font-semibold text-text-primary mb-1">Zaloguj się</h2>
          <p className="text-sm text-text-secondary mb-6">
            Użyj konta Microsoft Entra ID (Azure AD)
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-danger/30 text-danger text-sm">
              {error}
            </div>
          )}

          <Button
            onClick={handleLogin}
            loading={loading}
            size="lg"
            className="w-full"
          >
            <svg className="w-5 h-5" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="9" height="9" fill="#F25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
              <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
            </svg>
            Zaloguj przez Microsoft
          </Button>

          <p className="text-xs text-text-muted text-center mt-6">
            Logowanie wyłącznie dla pracowników {import.meta.env.VITE_ORG_NAME}.<br />
            Wymagane konto w domenie firmowej.
          </p>
        </div>
      </div>
    </div>
  )
}
