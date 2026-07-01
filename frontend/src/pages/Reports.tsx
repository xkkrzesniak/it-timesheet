import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, startOfMonth } from 'date-fns'
import { reportsApi } from '@/api/reports'
import { adminApi } from '@/api/admin'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { StatCard } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

export function Reports() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ADMIN'

  const [from, setFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [projectId, setProjectId] = useState('')
  const [userId, setUserId] = useState('')

  const params = { from, to, ...(projectId ? { projectId } : {}), ...(userId ? { userId } : {}) }

  const { data, isLoading } = useQuery({
    queryKey: ['reports', params],
    queryFn: () => reportsApi.summary(params),
  })

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => adminApi.getProjects(),
  })

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.getUsers(),
    enabled: isAdmin,
  })

  const projectOptions = projects.map((p) => ({ value: p.id, label: `${p.client.name} / ${p.name}` }))
  const userOptions = users.map((u) => ({ value: u.id, label: u.name }))

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Raporty</h1>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => reportsApi.exportCsv(params)}
          >
            Eksport CSV
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => reportsApi.exportPdf(params)}
          >
            Eksport PDF
          </Button>
        </div>
      </div>

      {/* Filtry */}
      <div className="flex flex-wrap gap-4 mb-6 bg-bg-card border border-border rounded-xl p-4">
        <Input label="Od" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        <Input label="Do" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        <Select
          label="Projekt"
          options={projectOptions}
          placeholder="Wszystkie projekty"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="w-56"
        />
        {isAdmin && (
          <Select
            label="Użytkownik"
            options={userOptions}
            placeholder="Wszyscy"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="w-48"
          />
        )}
      </div>

      {/* KPI — różne dla ADMIN i USER */}
      <div className={`grid gap-4 mb-8 ${isAdmin ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3'}`}>
        <StatCard
          label="Łącznie godzin"
          value={isLoading ? '...' : `${data?.totalHours ?? 0} h`}
          accent
        />
        <StatCard
          label="Wartość (własna)"
          value={isLoading ? '...' : `${data?.totalCost?.toFixed(2) ?? 0} zł`}
        />
        {isAdmin && (
          <>
            <StatCard
              label="Przychód"
              value={isLoading ? '...' : `${data?.totalRevenue?.toFixed(2) ?? 0} zł`}
              accent
            />
            <StatCard
              label="Marża"
              value={isLoading ? '...' : `${data?.totalMargin?.toFixed(2) ?? 0} zł`}
              sub={`${data?.marginPct ?? 0}%`}
            />
          </>
        )}
      </div>

      {/* Tabela */}
      <div className="bg-bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-border text-text-muted text-xs uppercase tracking-wider">
              <th className="px-4 py-3 text-left">Data</th>
              {isAdmin && <th className="px-4 py-3 text-left">Użytkownik</th>}
              <th className="px-4 py-3 text-left">Klient / Projekt</th>
              <th className="px-4 py-3 text-left">Opis</th>
              <th className="px-4 py-3 text-right">Czas</th>
              <th className="px-4 py-3 text-right">Stawka wł.</th>
              <th className="px-4 py-3 text-right">Koszt</th>
              {isAdmin && (
                <>
                  <th className="px-4 py-3 text-right">Stawka kl.</th>
                  <th className="px-4 py-3 text-right">Przychód</th>
                  <th className="px-4 py-3 text-right">Marża</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={isAdmin ? 10 : 7} className="py-12 text-center text-text-muted">
                  Ładowanie...
                </td>
              </tr>
            )}
            {data?.entries.map((e) => {
              const hours = (e.minutes / 60).toFixed(2)
              const margin = isAdmin ? Number(e.revenueValue) - Number(e.costValue) : 0
              return (
                <tr key={e.id} className="border-b border-border/50 hover:bg-bg-hover transition-colors">
                  <td className="px-4 py-3 text-text-secondary text-xs">{e.date.slice(0, 10)}</td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-text-primary">{e.user.name}</td>
                  )}
                  <td className="px-4 py-3">
                    <span className="text-text-muted text-xs">{e.project.client.name}</span>
                    <br />
                    <span className="text-text-primary">{e.project.name}</span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary max-w-[200px] truncate">{e.description ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-mono text-accent font-semibold">{hours} h</td>
                  <td className="px-4 py-3 text-right text-text-secondary">{Number(e.snapshotUserRate)} zł/h</td>
                  <td className="px-4 py-3 text-right text-text-primary">{Number(e.costValue).toFixed(2)} zł</td>
                  {isAdmin && (
                    <>
                      <td className="px-4 py-3 text-right text-text-secondary">{Number(e.snapshotClientRate)} zł/h</td>
                      <td className="px-4 py-3 text-right text-text-primary">{Number(e.revenueValue).toFixed(2)} zł</td>
                      <td className="px-4 py-3 text-right">
                        <Badge variant={margin >= 0 ? 'success' : 'danger'}>
                          {margin.toFixed(2)} zł
                        </Badge>
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
            {!isLoading && !data?.entries.length && (
              <tr>
                <td colSpan={isAdmin ? 10 : 7} className="py-12 text-center text-text-muted">
                  Brak danych w wybranym okresie
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
