import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, startOfMonth } from 'date-fns'
import { adminApi } from '@/api/admin'
import { reportsApi } from '@/api/reports'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export function AdminTimesheets() {
  const [from, setFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [userId, setUserId] = useState('')
  const [projectId, setProjectId] = useState('')

  const params = {
    from,
    to,
    ...(userId ? { userId } : {}),
    ...(projectId ? { projectId } : {}),
  }

  const { data, isLoading } = useQuery({
    queryKey: ['admin-timesheets', params],
    queryFn: () => adminApi.getTimesheets(params),
  })

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: adminApi.getUsers,
  })

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => adminApi.getProjects(),
  })

  const userOptions = users.map((u) => ({ value: u.id, label: u.name }))
  const projectOptions = projects.map((p) => ({ value: p.id, label: `${p.client.name} / ${p.name}` }))

  const t = data?.totals

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Wszystkie wpisy</h1>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => reportsApi.exportCsv(params)}>
            CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={() => reportsApi.exportPdf(params)}>
            PDF
          </Button>
        </div>
      </div>

      {/* Filtry */}
      <div className="flex flex-wrap gap-4 mb-6 bg-bg-card border border-border rounded-xl p-4">
        <Input label="Od" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        <Input label="Do" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        <Select
          label="Użytkownik"
          options={userOptions}
          placeholder="Wszyscy"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="w-48"
        />
        <Select
          label="Projekt"
          options={projectOptions}
          placeholder="Wszystkie projekty"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="w-56"
        />
      </div>

      {/* KPI */}
      {t && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <KpiTile label="Godzin" value={`${t.hours} h`} accent />
          <KpiTile label="Koszt" value={`${t.cost.toFixed(2)} zł`} />
          <KpiTile label="Przychód" value={`${t.revenue.toFixed(2)} zł`} accent />
          <KpiTile label="Marża" value={`${t.margin.toFixed(2)} zł`} />
          <KpiTile label="Marża %" value={`${t.marginPct}%`} accent={t.marginPct > 0} />
        </div>
      )}

      {/* Tabela */}
      <div className="bg-bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-border text-text-muted text-xs uppercase tracking-wider">
              <th className="px-4 py-3 text-left">Data</th>
              <th className="px-4 py-3 text-left">Pracownik</th>
              <th className="px-4 py-3 text-left">Klient / Projekt</th>
              <th className="px-4 py-3 text-left">Opis</th>
              <th className="px-4 py-3 text-right">Czas</th>
              <th className="px-4 py-3 text-right">Stawka wł.</th>
              <th className="px-4 py-3 text-right">Koszt</th>
              <th className="px-4 py-3 text-right">Stawka kl.</th>
              <th className="px-4 py-3 text-right">Przychód</th>
              <th className="px-4 py-3 text-right">Marża</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={10} className="py-12 text-center text-text-muted">Ładowanie...</td>
              </tr>
            )}
            {data?.entries.map((e) => {
              const margin = Number(e.revenueValue) - Number(e.costValue)
              return (
                <tr key={e.id} className="border-b border-border/50 hover:bg-bg-hover transition-colors">
                  <td className="px-4 py-3 text-text-secondary text-xs">{String(e.date).slice(0, 10)}</td>
                  <td className="px-4 py-3 text-text-primary">{e.user.name}</td>
                  <td className="px-4 py-3">
                    <span className="text-text-muted text-xs">{e.project.client.name}</span>
                    <br />
                    <span className="text-text-primary">{e.project.name}</span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary max-w-[150px] truncate">{e.description ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-mono text-accent font-semibold">
                    {(e.minutes / 60).toFixed(2)} h
                  </td>
                  <td className="px-4 py-3 text-right text-text-secondary text-xs">
                    {Number(e.snapshotUserRate).toFixed(0)} zł/h
                  </td>
                  <td className="px-4 py-3 text-right text-text-primary">
                    {Number(e.costValue).toFixed(2)} zł
                  </td>
                  <td className="px-4 py-3 text-right text-text-secondary text-xs">
                    {Number(e.snapshotClientRate).toFixed(0)} zł/h
                  </td>
                  <td className="px-4 py-3 text-right text-text-primary">
                    {Number(e.revenueValue).toFixed(2)} zł
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Badge variant={margin >= 0 ? 'success' : 'danger'}>
                      {margin.toFixed(2)} zł
                    </Badge>
                  </td>
                </tr>
              )
            })}
            {!isLoading && !data?.entries.length && (
              <tr>
                <td colSpan={10} className="py-12 text-center text-text-muted">Brak wpisów</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function KpiTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-bg border border-border rounded-xl p-4">
      <p className="text-xs text-text-muted uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-lg font-bold ${accent ? 'text-accent' : 'text-text-primary'}`}>{value}</p>
    </div>
  )
}
