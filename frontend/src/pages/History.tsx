import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, subDays } from 'date-fns'
import { timeEntriesApi } from '@/api/timeEntries'
import { adminApi } from '@/api/admin'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import type { TimeEntry } from '@/types'

export function History() {
  const qc = useQueryClient()

  const [from, setFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [projectId, setProjectId] = useState('')
  const [page, setPage] = useState(1)
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null)

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => adminApi.getProjects(),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['time-entries', { from, to, projectId, page }],
    queryFn: () =>
      timeEntriesApi.list({
        from,
        to,
        ...(projectId ? { projectId } : {}),
        page,
        limit: 20,
      }),
  })

  const deleteMut = useMutation({
    mutationFn: timeEntriesApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['time-entries'] }),
  })

  const projectOptions = projects.map((p) => ({
    value: p.id,
    label: `${p.client.name} / ${p.name}`,
  }))

  const totalMinutes = data?.items.reduce((s, e) => s + e.minutes, 0) ?? 0
  const totalCost = data?.items.reduce((s, e) => s + Number(e.costValue), 0) ?? 0

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-text-primary mb-6">Historia wpisów</h1>

      {/* Filtry */}
      <div className="flex flex-wrap gap-4 mb-6 bg-bg-card border border-border rounded-xl p-4">
        <Input
          label="Od"
          type="date"
          value={from}
          onChange={(e) => { setFrom(e.target.value); setPage(1) }}
          className="w-40"
        />
        <Input
          label="Do"
          type="date"
          value={to}
          onChange={(e) => { setTo(e.target.value); setPage(1) }}
          className="w-40"
        />
        <Select
          label="Projekt"
          options={projectOptions}
          placeholder="Wszystkie projekty"
          value={projectId}
          onChange={(e) => { setProjectId(e.target.value); setPage(1) }}
          className="w-56"
        />
      </div>

      {/* Podsumowanie */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <SummaryTile label="Łącznie wpisów" value={String(data?.total ?? 0)} />
        <SummaryTile
          label="Łącznie godzin"
          value={`${(totalMinutes / 60).toFixed(2)} h`}
          accent
        />
        <SummaryTile
          label="Wartość (własna stawka)"
          value={`${totalCost.toFixed(2)} zł`}
        />
      </div>

      {/* Tabela */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-text-muted text-xs uppercase tracking-wider">
              <th className="px-4 py-3 text-left">Data</th>
              <th className="px-4 py-3 text-left">Klient / Projekt</th>
              <th className="px-4 py-3 text-left">Opis</th>
              <th className="px-4 py-3 text-right">Czas</th>
              <th className="px-4 py-3 text-right">Wartość</th>
              <th className="px-4 py-3 text-right">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-text-muted">Ładowanie...</td>
              </tr>
            )}
            {data?.items.map((e) => (
              <tr key={e.id} className="border-b border-border/50 hover:bg-bg-hover transition-colors">
                <td className="px-4 py-3 text-text-secondary">{e.date.slice(0, 10)}</td>
                <td className="px-4 py-3">
                  <span className="text-text-muted text-xs">{e.project.client.name}</span>
                  <br />
                  <span className="text-text-primary font-medium">{e.project.name}</span>
                </td>
                <td className="px-4 py-3 text-text-secondary max-w-xs truncate">{e.description ?? '—'}</td>
                <td className="px-4 py-3 text-right text-accent font-semibold font-mono">
                  {(e.minutes / 60).toFixed(2)} h
                </td>
                <td className="px-4 py-3 text-right text-text-primary">
                  {Number(e.costValue).toFixed(2)} zł
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setEditEntry(e)}
                      className="text-xs text-text-muted hover:text-accent transition-colors"
                    >
                      Edytuj
                    </button>
                    <button
                      onClick={() => deleteMut.mutate(e.id)}
                      className="text-xs text-text-muted hover:text-danger transition-colors"
                    >
                      Usuń
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && !data?.items.length && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-text-muted">
                  Brak wpisów w wybranym okresie
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginacja */}
      {data && data.total > 20 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button
            variant="secondary"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ← Poprzednia
          </Button>
          <span className="text-sm text-text-secondary self-center">
            {page} / {Math.ceil(data.total / 20)}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page * 20 >= data.total}
            onClick={() => setPage((p) => p + 1)}
          >
            Następna →
          </Button>
        </div>
      )}

      {editEntry && (
        <EditModal
          entry={editEntry}
          onClose={() => setEditEntry(null)}
          onSaved={() => {
            setEditEntry(null)
            qc.invalidateQueries({ queryKey: ['time-entries'] })
          }}
        />
      )}
    </div>
  )
}

function SummaryTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-4">
      <p className="text-xs text-text-muted uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl font-bold ${accent ? 'text-accent' : 'text-text-primary'}`}>{value}</p>
    </div>
  )
}

function EditModal({
  entry,
  onClose,
  onSaved,
}: {
  entry: TimeEntry
  onClose: () => void
  onSaved: () => void
}) {
  const [minutes, setMinutes] = useState(String(entry.minutes))
  const [description, setDescription] = useState(entry.description ?? '')
  const [date, setDate] = useState(entry.date.slice(0, 10))

  const update = useMutation({
    mutationFn: () =>
      timeEntriesApi.update(entry.id, {
        minutes: parseInt(minutes),
        description: description || undefined,
        date,
      }),
    onSuccess: onSaved,
  })

  return (
    <Modal open title="Edytuj wpis" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Input label="Data" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input
          label="Minuty"
          type="number"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
        />
        <Input
          label="Opis"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onClose}>Anuluj</Button>
          <Button onClick={() => update.mutate()} loading={update.isPending}>Zapisz</Button>
        </div>
      </div>
    </Modal>
  )
}
