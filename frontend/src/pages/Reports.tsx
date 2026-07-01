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
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null)

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

  const handleExport = async (type: 'csv' | 'pdf') => {
    setExporting(type)
    try {
      if (type === 'csv') await reportsApi.exportCsv(params)
      else await reportsApi.exportPdf(params)
    } finally {
      setExporting(null)
    }
  }

  const cols = isAdmin ? 9 : 6

  return (
    <div className="p-6 max-w-full mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Raporty</h1>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            loading={exporting === 'csv'}
            onClick={() => handleExport('csv')}
          >
            Eksport CSV
          </Button>
          <Button
            variant="secondary"
            size="sm"
            loading={exporting === 'pdf'}
            onClick={() => handleExport('pdf')}
          >
            Eksport PDF
          </Button>
        </div>
      </div>

      {/* Filtry */}
      <div className="flex flex-wrap gap-3 mb-6 bg-bg-card border border-border rounded-xl p-4">
        <Input label="Od" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36" />
        <Input label="Do" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36" />
        <Select
          label="Projekt"
          options={projectOptions}
          placeholder="Wszystkie"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="w-52"
        />
        {isAdmin && (
          <Select
            label="Użytkownik"
            options={userOptions}
            placeholder="Wszyscy"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="w-44"
          />
        )}
      </div>

      {/* KPI */}
      <div className={`grid gap-4 mb-6 ${isAdmin ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 lg:grid-cols-3'}`}>
        <StatCard label="Łącznie godzin" value={isLoading ? '...' : `${data?.totalHours ?? 0} h`} accent />
        <StatCard label="Koszt własny" value={isLoading ? '...' : `${data?.totalCost?.toFixed(2) ?? 0} zł`} />
        {isAdmin && (
          <>
            <StatCard label="Przychód" value={isLoading ? '...' : `${data?.totalRevenue?.toFixed(2) ?? 0} zł`} accent />
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
        <table className="text-xs w-full" style={{ minWidth: isAdmin ? '900px' : '600px' }}>
          <thead>
            <tr className="border-b border-border text-text-muted uppercase tracking-wider">
              <th className="px-3 py-3 text-left whitespace-nowrap">Data</th>
              {isAdmin && <th className="px-3 py-3 text-left whitespace-nowrap">Pracownik</th>}
              <th className="px-3 py-3 text-left whitespace-nowrap">Klient / Projekt</th>
              <th className="px-3 py-3 text-left">Opis</th>
              <th className="px-3 py-3 text-right whitespace-nowrap">Czas</th>
              <th className="px-3 py-3 text-right whitespace-nowrap">St.wł.</th>
              <th className="px-3 py-3 text-right whitespace-nowrap">Koszt</th>
              {isAdmin && (
                <>
                  <th className="px-3 py-3 text-right whitespace-nowrap">St.kl.</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap">Przychód</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap">Marża</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={cols} className="py-12 text-center text-text-muted">Ładowanie...</td>
              </tr>
            )}
            {data?.entries.map((e) => {
              const hours = (e.minutes / 60).toFixed(2)
              const margin = isAdmin ? Number(e.revenueValue) - Number(e.costValue) : 0
              return (
                <tr key={e.id} className="border-b border-border/50 hover:bg-bg-hover transition-colors">
                  <td className="px-3 py-2.5 text-text-muted whitespace-nowrap">{e.date.slice(0, 10)}</td>
                  {isAdmin && <td className="px-3 py-2.5 text-text-primary whitespace-nowrap">{e.user.name}</td>}
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="text-text-muted block text-[10px]">{e.project.client.name}</span>
                    <span className="text-text-primary font-medium">{e.project.name}</span>
                  </td>
                  <td className="px-3 py-2.5 text-text-secondary max-w-[150px] truncate">{e.description ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-accent font-semibold whitespace-nowrap">{hours} h</td>
                  <td className="px-3 py-2.5 text-right text-text-secondary whitespace-nowrap">{Number(e.snapshotUserRate)} zł/h</td>
                  <td className="px-3 py-2.5 text-right text-text-primary whitespace-nowrap">{Number(e.costValue).toFixed(2)} zł</td>
                  {isAdmin && (
                    <>
                      <td className="px-3 py-2.5 text-right text-text-secondary whitespace-nowrap">{Number(e.snapshotClientRate)} zł/h</td>
                      <td className="px-3 py-2.5 text-right text-text-primary whitespace-nowrap">{Number(e.revenueValue).toFixed(2)} zł</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
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
                <td colSpan={cols} className="py-12 text-center text-text-muted">
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
