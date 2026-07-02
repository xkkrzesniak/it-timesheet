import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useAuthStore } from './store/authStore'
import { AppLayout } from './components/layout/AppLayout'
import { Login } from './pages/Login'
import { Track } from './pages/Track'
import { History } from './pages/History'
import { Reports } from './pages/Reports'
import { AdminUsers } from './pages/admin/Users'
import { AdminClients } from './pages/admin/Clients'
import { AdminTimesheets } from './pages/admin/Timesheets'
import { AdminProjects } from './pages/admin/Projects'
import { AdminTags } from './pages/admin/Tags'
import { FakturowniaSettings } from './pages/admin/FakturowniaSettings'
import { Dashboard } from './pages/Dashboard'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (user?.role !== 'ADMIN') return <Navigate to="/track" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/track" element={<Track />} />
            <Route path="/history" element={<History />} />
            <Route path="/reports" element={<Reports />} />
            <Route
              path="/admin/timesheets"
              element={<RequireAdmin><AdminTimesheets /></RequireAdmin>}
            />
            <Route
              path="/admin/users"
              element={<RequireAdmin><AdminUsers /></RequireAdmin>}
            />
            <Route
              path="/admin/clients"
              element={<RequireAdmin><AdminClients /></RequireAdmin>}
            />
            <Route
              path="/admin/projects"
              element={<RequireAdmin><AdminProjects /></RequireAdmin>}
            />
            <Route
              path="/admin/tags"
              element={<RequireAdmin><AdminTags /></RequireAdmin>}
            />
            <Route
              path="/admin/fakturownia"
              element={<RequireAdmin><FakturowniaSettings /></RequireAdmin>}
            />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
