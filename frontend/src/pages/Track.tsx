import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import clsx from 'clsx'
import { useTimer } from '@/hooks/useTimer'
import { timeEntriesApi } from '@/api/timeEntries'
import { adminApi } from '@/api/admin'
import { tagsApi } from '@/api/tags'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { TagBadge } from '@/pages/admin/Tags'

type Prefill = { clientId?: string; projectId?: string; description?: string }

export function Track() {
  const qc = useQueryClient()
  const timer = useTimer()
  const location = useLocation()
  const prefill = (location.state as Prefill | null) ?? null
  const [mode, setMode] = useState<'timer' | 'manual'>('timer')

  const [manualForm, setManualForm] = useState({
    clientId: '',
    projectId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    hours: '',
    minutes: '',
    description: '',
    tagId: '',
  })
  const [timerTagId, setTimerTagId] = useState('')

  // Apply prefill from "Powtórz" in History
  useEffect(() => {
    if (!prefill) return
    if (prefill.clientId) {
      timer.setClientId(prefill.clientId)
      if (prefill.projectId) timer.setProjectId(prefill.projectId)
      if (prefill.description) timer.setDescription(prefill.description)
    }
    setManualForm((f) => ({
      ...f,
      clientId: prefill.clientId ?? f.clientId,
      projectId: prefill.projectId ?? f.projectId,
      description: prefill.description ?? f.description,
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => adminApi.getClients(),
  })

  const { data: allProjects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => adminApi.getProjects(),
  })

  const { data: tags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: tagsApi.getAll,
  })

  const activeTimerProject = allProjects.find((p) => p.id === timer.projectId)
  const activeManualProject = allProjects.find((p) => p.id === manualForm.projectId)

  const { data: timerProjectStats } = useQuery({
    queryKey: ['project-stats', timer.projectId],
    queryFn: () => adminApi.getProjectStats(timer.projectId!),
    enabled: !!timer.projectId && !!activeTimerProject?.hoursBudget,
  })

  const { data: manualProjectStats } = useQuery({
    queryKey: ['project-stats', manualForm.projectId],
    queryFn: () => adminApi.getProjectStats(manualForm.projectId),
    enabled: !!manualForm.projectId && !!activeManualProject?.hoursBudget,
  })

  const save = useMutation({
    mutationFn: timeEntriesApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['time-entries'] })
      setManualForm((f) => ({ ...f, hours: '', minutes: '', description: '' }))
    },
  })

  const clientOptions = clients.map((c) => ({ value: c.id, label: c.name }))

  const projectsForClient = (clientId: string) =>
    allProjects
      .filter((p) => p.client.id === clientId)
      .map((p) => ({ value: p.id, label: p.name, billingType: p.billingType }))

  const timerProjectsForClient = projectsForClient(timer.clientId ?? '')
  const manualProjectsForClient = projectsForClient(manualForm.clientId)

  const handleTimerToggle = () => {
    if (timer.running) {
      const result = timer.stop()
      if (!result || !timer.projectId) return
      save.mutate({
        projectId: timer.projectId,
        date: format(result.startTime, 'yyyy-MM-dd'),
        minutes: result.minutes,
        description: timer.description || undefined,
        startTime: result.startTime.toISOString(),
        endTime: result.endTime.toISOString(),
        tagId: timerTagId || undefined,
      })
    } else {
      if (!timer.projectId) return
      timer.start(timer.projectId, timer.description)
    }
  }

  const handleManualSave = () => {
    const totalMinutes =
      (parseInt(manualForm.hours || '0') * 60) + parseInt(manualForm.minutes || '0')
    if (!manualForm.projectId || totalMinutes <= 0) return
    save.mutate({
      projectId: manualForm.projectId,
      date: manualForm.date,
      minutes: totalMinutes,
      description: manualForm.description || undefined,
      tagId: manualForm.tagId || undefined,
    })
    setManualForm((f) => ({ ...f, projectId: '', hours: '', minutes: '', description: '', tagId: '' }))
  }

  const { data: recent } = useQuery({
    queryKey: ['time-entries', { limit: 10 }],
    queryFn: () => timeEntriesApi.list({ limit: 10 }),
  })

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Rejestruj czas</h1>
        <p className="text-text-secondary text-sm mt-1">
          {format(new Date(), 'EEEE, d MMMM yyyy', { locale: pl })}
        </p>
      </div>

      {/* Mode switcher */}
      <div className="flex gap-1 p-1 bg-bg-card border border-border rounded-lg w-fit mb-6">
        {(['timer', 'manual'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={clsx(
              'px-5 py-1.5 rounded-md text-sm font-medium transition-colors',
              mode === m ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary',
            )}
          >
            {m === 'timer' ? 'Timer' : 'Ręczny wpis'}
          </button>
        ))}
      </div>

      {mode === 'timer' ? (
        <Card className="flex flex-col gap-6">
          <div className="text-center py-4">
            <div
              className={clsx(
                'text-6xl font-mono font-bold tabular-nums transition-colors',
                timer.running ? 'text-accent' : 'text-text-muted',
              )}
            >
              {timer.formatted}
            </div>
            {timer.running && (
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse-slow" />
                <span className="text-sm text-text-secondary">Nagrywanie...</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Klient"
              options={clientOptions}
              placeholder="Wybierz klienta..."
              value={timer.clientId ?? ''}
              onChange={(e) => {
                timer.setClientId(e.target.value)
                timer.setProjectId('')
              }}
              disabled={timer.running}
            />
            <Select
              label="Projekt"
              options={timerProjectsForClient}
              placeholder={timer.clientId ? 'Wybierz projekt...' : 'Najpierw wybierz klienta'}
              value={timer.projectId ?? ''}
              onChange={(e) => timer.setProjectId(e.target.value)}
              disabled={timer.running || !timer.clientId}
            />
          </div>

          {timer.projectId && activeTimerProject && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs text-text-muted flex-wrap">
                <Badge variant={activeTimerProject.billingType === 'FIXED' ? 'success' : 'accent'}>
                  {activeTimerProject.billingType === 'FIXED' ? 'Ryczałt' : 'Godzinowe'}
                </Badge>
                {activeTimerProject.description && <span>{activeTimerProject.description}</span>}
              </div>
              {timerProjectStats && timerProjectStats.hoursBudget && (
                <BudgetBar used={timerProjectStats.usedHours} budget={timerProjectStats.hoursBudget} />
              )}
            </div>
          )}

          {tags.length > 0 && (
            <div>
              <p className="text-sm text-text-secondary font-medium mb-2">Kategoria (opcjonalna)</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setTimerTagId('')}
                  className={clsx('text-xs px-3 py-1 rounded-full border transition-colors',
                    !timerTagId ? 'border-accent text-accent' : 'border-border text-text-muted hover:border-text-muted'
                  )}
                >
                  Bez kategorii
                </button>
                {tags.map((t) => (
                  <button key={t.id} onClick={() => setTimerTagId(t.id)}>
                    <span className={clsx(timerTagId === t.id ? 'ring-2 ring-offset-1 ring-offset-bg-card rounded-full' : '')}>
                      <TagBadge tag={t} />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-sm text-text-secondary font-medium">Opis (opcjonalny)</label>
            <input
              className="bg-bg-input border border-border rounded-lg px-3 py-2 text-text-primary placeholder-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="Co robisz?"
              value={timer.description}
              onChange={(e) => timer.setDescription(e.target.value)}
            />
          </div>

          <Button
            onClick={handleTimerToggle}
            size="lg"
            variant={timer.running ? 'danger' : 'primary'}
            disabled={!timer.projectId && !timer.running}
            loading={save.isPending}
            className="w-full"
          >
            {timer.running ? 'Zatrzymaj i zapisz' : 'Rozpocznij timer'}
          </Button>
        </Card>
      ) : (
        <Card className="flex flex-col gap-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Klient"
              options={clientOptions}
              placeholder="Wybierz klienta..."
              value={manualForm.clientId}
              onChange={(e) =>
                setManualForm((f) => ({ ...f, clientId: e.target.value, projectId: '' }))
              }
            />
            <Select
              label="Projekt"
              options={manualProjectsForClient}
              placeholder={manualForm.clientId ? 'Wybierz projekt...' : 'Najpierw wybierz klienta'}
              value={manualForm.projectId}
              onChange={(e) => setManualForm((f) => ({ ...f, projectId: e.target.value }))}
              disabled={!manualForm.clientId}
            />
          </div>

          {manualForm.projectId && activeManualProject && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs text-text-muted flex-wrap">
                <Badge variant={activeManualProject.billingType === 'FIXED' ? 'success' : 'accent'}>
                  {activeManualProject.billingType === 'FIXED' ? 'Ryczałt' : 'Godzinowe'}
                </Badge>
                {activeManualProject.description && <span>{activeManualProject.description}</span>}
              </div>
              {manualProjectStats && manualProjectStats.hoursBudget && (
                <BudgetBar used={manualProjectStats.usedHours} budget={manualProjectStats.hoursBudget} />
              )}
            </div>
          )}

          {tags.length > 0 && (
            <div>
              <p className="text-sm text-text-secondary font-medium mb-2">Kategoria (opcjonalna)</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setManualForm((f) => ({ ...f, tagId: '' }))}
                  className={clsx('text-xs px-3 py-1 rounded-full border transition-colors',
                    !manualForm.tagId ? 'border-accent text-accent' : 'border-border text-text-muted hover:border-text-muted'
                  )}
                >
                  Bez kategorii
                </button>
                {tags.map((t) => (
                  <button key={t.id} onClick={() => setManualForm((f) => ({ ...f, tagId: t.id }))}>
                    <span className={clsx(manualForm.tagId === t.id ? 'ring-2 ring-offset-1 ring-offset-bg-card rounded-full' : '')}>
                      <TagBadge tag={t} />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <Input
            label="Data"
            type="date"
            value={manualForm.date}
            onChange={(e) => setManualForm((f) => ({ ...f, date: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Godziny"
              type="number"
              min="0"
              max="24"
              placeholder="0"
              value={manualForm.hours}
              onChange={(e) => setManualForm((f) => ({ ...f, hours: e.target.value }))}
            />
            <Input
              label="Minuty"
              type="number"
              min="0"
              max="59"
              placeholder="0"
              value={manualForm.minutes}
              onChange={(e) => setManualForm((f) => ({ ...f, minutes: e.target.value }))}
            />
          </div>
          <Input
            label="Opis (opcjonalny)"
            placeholder="Opis wykonanej pracy..."
            value={manualForm.description}
            onChange={(e) => setManualForm((f) => ({ ...f, description: e.target.value }))}
          />
          <Button
            onClick={handleManualSave}
            size="lg"
            loading={save.isPending}
            disabled={!manualForm.projectId || (!manualForm.hours && !manualForm.minutes)}
            className="w-full"
          >
            Zapisz wpis
          </Button>
        </Card>
      )}

      {/* Ostatnie wpisy */}
      <div className="mt-10">
        <h2 className="text-base font-semibold text-text-primary mb-4">Ostatnie wpisy</h2>
        <div className="space-y-2">
          {recent?.items.map((e) => <EntryRow key={e.id} entry={e} />)}
          {!recent?.items.length && (
            <p className="text-text-muted text-sm text-center py-8">Brak wpisów. Dodaj pierwszy!</p>
          )}
        </div>
      </div>
    </div>
  )
}

function BudgetBar({ used, budget }: { used: number; budget: number }) {
  const pct = Math.min((used / budget) * 100, 100)
  const remaining = Math.max(budget - used, 0)
  const danger = pct >= 90
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-text-muted">Budżet projektu</span>
        <span className={danger ? 'text-danger font-semibold' : 'text-text-muted'}>
          {remaining.toFixed(1)} h pozostało z {budget} h
        </span>
      </div>
      <div className="h-1.5 bg-bg-hover rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${danger ? 'bg-danger' : 'bg-accent'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function EntryRow({ entry }: { entry: import('@/types').TimeEntry }) {
  return (
    <div className="flex items-center justify-between py-3 px-4 bg-bg-card border border-border rounded-lg hover:border-accent/30 transition-colors">
      <div className="flex items-center gap-4">
        <div className="text-xs text-text-muted w-20 shrink-0">{entry.date.slice(0, 10)}</div>
        <div>
          <p className="text-sm font-medium text-text-primary">
            {entry.project.client.name} / {entry.project.name}
          </p>
          {entry.description && (
            <p className="text-xs text-text-secondary mt-0.5">{entry.description}</p>
          )}
          {entry.tag && <TagBadge tag={entry.tag} />}
        </div>
      </div>
      <div className="text-right shrink-0 ml-4">
        <p className="text-sm font-semibold text-accent">{(entry.minutes / 60).toFixed(2)} h</p>
        <p className="text-xs text-text-muted">{Number(entry.costValue).toFixed(2)} zł</p>
      </div>
    </div>
  )
}
