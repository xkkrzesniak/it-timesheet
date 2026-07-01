import { useQuery } from '@tanstack/react-query'
import { format, startOfMonth } from 'date-fns'
import { pl } from 'date-fns/locale'
import { dashboardApi } from '@/api/dashboard'
import { useAuthStore } from '@/store/authStore'

export function Dashboard() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ADMIN'

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: dashboardApi.getStats,
    refetchInterval: 60_000,
  })

  const monthLabel = format(startOfMonth(new Date()), 'LLLL yyyy', { locale: pl })

  const weekDelta = data
    ? data.lastWeek.hours > 0
      ? ((data.thisWeek.hours - data.lastWeek.hours) / data.lastWeek.hours) * 100
      : null
    : null

  const monthDelta = data
    ? data.lastMonth.hours > 0
      ? ((data.thisMonth.hours - data.lastMonth.hours) / data.lastMonth.hours) * 100
      : null
    : null

  const maxClientHours = data?.topClients[0]?.hours ?? 1

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
        <p className="text-text-secondary text-sm mt-1 capitalize">{monthLabel}</p>
      </div>

      {/* KPI row */}
      <div className={`grid gap-4 mb-8 ${isAdmin ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 lg:grid-cols-3'}`}>
        <StatCard
          label="Ten tydzień"
          value={isLoading ? '...' : `${data?.thisWeek.hours ?? 0} h`}
          delta={weekDelta}
          sub="vs. zeszły tydzień"
          accent
        />
        <StatCard
          label="Ten miesiąc"
          value={isLoading ? '...' : `${data?.thisMonth.hours ?? 0} h`}
          delta={monthDelta}
          sub="vs. zeszły miesiąc"
        />
        <StatCard
          label="Koszt (mies.)"
          value={isLoading ? '...' : `${data?.thisMonth.cost.toFixed(2) ?? 0} zł`}
        />
        {isAdmin && (
          <StatCard
            label="Zeszły miesiąc"
            value={isLoading ? '...' : `${data?.lastMonth.hours ?? 0} h`}
            sub={`${data?.lastMonth.cost.toFixed(2) ?? 0} zł`}
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top klienci */}
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-4 uppercase tracking-wider">
            Top klienci — {monthLabel}
          </h2>
          {isLoading && <Skeleton />}
          {!isLoading && !data?.topClients.length && (
            <p className="text-text-muted text-sm text-center py-6">Brak danych w tym miesiącu</p>
          )}
          <div className="space-y-3">
            {data?.topClients.map((c) => (
              <div key={c.name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-text-primary font-medium truncate max-w-[60%]">{c.name}</span>
                  <span className="text-text-muted font-mono">{c.hours} h</span>
                </div>
                <div className="h-1.5 bg-bg-hover rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all"
                    style={{ width: `${(c.hours / maxClientHours) * 100}%` }}
                  />
                </div>
                {isAdmin && (
                  <p className="text-[10px] text-text-muted mt-0.5 text-right">{c.cost.toFixed(2)} zł</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Top projekty */}
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-4 uppercase tracking-wider">
            Top projekty — {monthLabel}
          </h2>
          {isLoading && <Skeleton />}
          {!isLoading && !data?.topProjects.length && (
            <p className="text-text-muted text-sm text-center py-6">Brak danych w tym miesiącu</p>
          )}
          <div className="space-y-2">
            {data?.topProjects.map((p, i) => (
              <div
                key={p.name + p.clientName}
                className="flex items-center gap-3 py-2 border-b border-border/40 last:border-0"
              >
                <span className="text-xs font-mono text-text-muted w-4 shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{p.name}</p>
                  <p className="text-xs text-text-muted truncate">{p.clientName}</p>
                </div>
                <span className="text-sm font-mono font-semibold text-accent shrink-0">{p.hours} h</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  delta,
  accent,
}: {
  label: string
  value: string
  sub?: string
  delta?: number | null
  accent?: boolean
}) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-4">
      <p className="text-xs text-text-muted uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-2xl font-bold ${accent ? 'text-accent' : 'text-text-primary'}`}>{value}</p>
      <div className="flex items-center gap-2 mt-1">
        {delta != null && (
          <span className={`text-xs font-medium ${delta >= 0 ? 'text-success' : 'text-danger'}`}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(0)}%
          </span>
        )}
        {sub && <span className="text-xs text-text-muted">{sub}</span>}
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-3 py-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-8 bg-bg-hover rounded animate-pulse" />
      ))}
    </div>
  )
}
