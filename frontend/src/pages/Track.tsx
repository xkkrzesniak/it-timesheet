import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import clsx from 'clsx'
import { useTimer } from '@/hooks/useTimer'
import { timeEntriesApi } from '@/api/timeEntries'
import { adminApi } from '@/api/admin'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'

export function Track() {
  const qc = useQueryClient()
  const timer = useTimer()

  // Tryb: timer | manual
  const [mode, setMode] = useState<'timer' | 'manual'>('timer')

  // Formularz ręczny
  const [manualForm, setManualForm] = useState({
    projectId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    hours: '',
    minutes: '',
    description: '',
  })

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => adminApi.getProjects(),
  })

  const save = useMutation({
    mutationFn: timeEntriesApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['time-entries'] }),
  })

  // Projekty do selecta
  const projectOptions = projects.map((p) => ({
    value: p.id,
    label: `${p.client.name} / ${p.name}`,
  }))

  // Timer actions
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
      })
    } else {
      if (!timer.projectId) return
      timer.start(timer.projectId, timer.description)
    }
  }

  // Ręczny zapis
  const handleManualSave = () => {
    const totalMinutes = (parseInt(manualForm.hours || '0') * 60) + parseInt(manualForm.minutes || '0')
    if (!manualForm.projectId || totalMinutes <= 0) return
    save.mutate({
      projectId: manualForm.projectId,
      date: manualForm.date,
      minutes: totalMinutes,
      description: manualForm.description || undefined,
    })
    setManualForm((f) => ({ ...f, hours: '', minutes: '', description: '' }))
  }

  // Ostatnie wpisy
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
        <TimerPanel
          timer={timer}
          projectOptions={projectOptions}
          onToggle={handleTimerToggle}
          saving={save.isPending}
        />
      ) : (
        <ManualPanel
          form={manualForm}
          onChange={(k, v) => setManualForm((f) => ({ ...f, [k]: v }))}
          projectOptions={projectOptions}
          onSave={handleManualSave}
          saving={save.isPending}
        />
      )}

      {/* Ostatnie wpisy */}
      <div className="mt-10">
        <h2 className="text-base font-semibold text-text-primary mb-4">Ostatnie wpisy</h2>
        <div className="space-y-2">
          {recent?.items.map((e) => (
            <EntryRow key={e.id} entry={e} />
          ))}
          {!recent?.items.length && (
            <p className="text-text-muted text-sm text-center py-8">Brak wpisów. Dodaj pierwszy!</p>
          )}
        </div>
      </div>
    </div>
  )
}

function TimerPanel({
  timer,
  projectOptions,
  onToggle,
  saving,
}: {
  timer: ReturnType<typeof useTimer>
  projectOptions: { value: string; label: string }[]
  onToggle: () => void
  saving: boolean
}) {
  return (
    <Card className="flex flex-col gap-6">
      {/* Zegar */}
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
          label="Projekt"
          options={projectOptions}
          placeholder="Wybierz projekt..."
          value={timer.projectId ?? ''}
          onChange={(e) => timer.setProjectId(e.target.value)}
          disabled={timer.running}
        />
        <div className="flex flex-col gap-1">
          <label className="text-sm text-text-secondary font-medium">Opis (opcjonalny)</label>
          <input
            className="bg-bg-input border border-border rounded-lg px-3 py-2 text-text-primary placeholder-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="Co robisz?"
            value={timer.description}
            onChange={(e) => timer.setDescription(e.target.value)}
          />
        </div>
      </div>

      <Button
        onClick={onToggle}
        size="lg"
        variant={timer.running ? 'danger' : 'primary'}
        disabled={!timer.projectId && !timer.running}
        loading={saving}
        className="w-full"
      >
        {timer.running ? 'Zatrzymaj i zapisz' : 'Rozpocznij timer'}
      </Button>
    </Card>
  )
}

function ManualPanel({
  form,
  onChange,
  projectOptions,
  onSave,
  saving,
}: {
  form: { projectId: string; date: string; hours: string; minutes: string; description: string }
  onChange: (k: string, v: string) => void
  projectOptions: { value: string; label: string }[]
  onSave: () => void
  saving: boolean
}) {
  return (
    <Card className="flex flex-col gap-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label="Projekt"
          options={projectOptions}
          placeholder="Wybierz projekt..."
          value={form.projectId}
          onChange={(e) => onChange('projectId', e.target.value)}
        />
        <Input
          label="Data"
          type="date"
          value={form.date}
          onChange={(e) => onChange('date', e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Godziny"
          type="number"
          min="0"
          max="24"
          placeholder="0"
          value={form.hours}
          onChange={(e) => onChange('hours', e.target.value)}
        />
        <Input
          label="Minuty"
          type="number"
          min="0"
          max="59"
          placeholder="0"
          value={form.minutes}
          onChange={(e) => onChange('minutes', e.target.value)}
        />
      </div>
      <Input
        label="Opis (opcjonalny)"
        placeholder="Opis wykonanej pracy..."
        value={form.description}
        onChange={(e) => onChange('description', e.target.value)}
      />
      <Button
        onClick={onSave}
        size="lg"
        loading={saving}
        disabled={!form.projectId || (!form.hours && !form.minutes)}
        className="w-full"
      >
        Zapisz wpis
      </Button>
    </Card>
  )
}

function EntryRow({ entry }: { entry: import('@/types').TimeEntry }) {
  const hours = (entry.minutes / 60).toFixed(2)
  return (
    <div className="flex items-center justify-between py-3 px-4 bg-bg-card border border-border rounded-lg hover:border-accent/30 transition-colors">
      <div className="flex items-center gap-4">
        <div className="text-xs text-text-muted w-20 shrink-0">
          {entry.date.slice(0, 10)}
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary">
            {entry.project.client.name} / {entry.project.name}
          </p>
          {entry.description && (
            <p className="text-xs text-text-secondary mt-0.5">{entry.description}</p>
          )}
        </div>
      </div>
      <div className="text-right shrink-0 ml-4">
        <p className="text-sm font-semibold text-accent">{hours} h</p>
        <p className="text-xs text-text-muted">{Number(entry.costValue).toFixed(2)} zł</p>
      </div>
    </div>
  )
}
