import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MsalProvider } from '@azure/msal-react'
import { PublicClientApplication } from '@azure/msal-browser'
import './styles/globals.css'
import App from './App'
import { msalConfig } from './auth/msalConfig'

// MSAL v3 wymaga jawnej inicjalizacji przed użyciem
const msalInstance = new PublicClientApplication(msalConfig)

msalInstance.initialize().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
    </StrictMode>,
  )
})
