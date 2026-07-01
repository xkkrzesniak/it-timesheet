import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/admin'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import type { Project, BillingType, ProjectNote } from '@/types'

const BILLING_LABELS: Record<BillingType, string> = {
  HOURLY: 'Godzinowe',
  FIXED: 'Ryczałt',
}

export function AdminProjects() {
  const qc = useQueryClient()
  const [filterClient, setFilterClient] = useState('')
  const [modal, setModal] = useState<{ open: boolean; project: Project | null }>({ open: false, project: null })
  const [notesProject, setNotesProject] = useState<Project | null>(null)

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects-admin', filterClient],
    queryFn: () => adminApi.getProjects(filterClient || undefined),
  })

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => adminApi.getClients(),
  })

  const deleteMut = useMutation({
    mutationFn: adminApi.deleteProject,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects-admin'] }),
  })

  const clientOptions = clients.map((c) => ({ value: c.id, label: c.name }))

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Projekty</h1>
        <Button onClick={() => setModal({ open: true, project: null })}>+ Nowy projekt</Button>
      </div>

      {/* Filtr po kliencie */}
      <div className="mb-6 flex gap-4 bg-bg-card border border-border rounded-xl p-4">
        <Select
          label="Filtruj po kliencie"
          options={clientOptions}
          placeholder="Wszyscy klienci"
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
          className="w-64"
        />
      </div>

      {/* Tabela */}
      <div className="bg-bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-text-muted text-xs uppercase tracking-wider">
              <th className="px-4 py-3 text-left">Projekt</th>
              <th className="px-4 py-3 text-left">Klient</th>
              <th className="px-4 py-3 text-left">Rozliczenie</th>
              <th className="px-4 py-3 text-left">Opis</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-text-muted">Ładowanie...</td>
              </tr>
            )}
            {projects.map((p) => (
              <tr key={p.id} className="border-b border-border/50 hover:bg-bg-hover transition-colors">
                <td className="px-4 py-3 font-medium text-text-primary">{p.name}</td>
                <td className="px-4 py-3 text-text-secondary">{p.client.name}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <Badge variant={p.billingType === 'HOURLY' ? 'accent' : 'success'}>
                      {BILLING_LABELS[p.billingType]}
                    </Badge>
                    {p.hoursBudget && (
                      <span className="text-xs text-text-muted">{p.hoursBudget} h</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-text-muted max-w-xs truncate">{p.description || '—'}</td>
                <td className="px-4 py-3">
                  <Badge variant={p.isActive ? 'success' : 'danger'}>
                    {p.isActive ? 'Aktywny' : 'Nieaktywny'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setNotesProject(p)}
                      className="text-xs text-text-muted hover:text-success transition-colors"
                    >
                      Notatki
                    </button>
                    <button
                      onClick={() => setModal({ open: true, project: p })}
                      className="text-xs text-text-muted hover:text-accent transition-colors"
                    >
                      Edytuj
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Dezaktywować projekt "${p.name}"?`)) {
                          deleteMut.mutate(p.id)
                        }
                      }}
                      className="text-xs text-text-muted hover:text-danger transition-colors"
                    >
                      Usuń
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && !projects.length && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-text-muted">
                  Brak projektów. Dodaj pierwszy!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal.open && (
        <ProjectModal
          project={modal.project}
          clients={clients}
          onClose={() => setModal({ open: false, project: null })}
          onSaved={() => {
            setModal({ open: false, project: null })
            qc.invalidateQueries({ queryKey: ['projects-admin'] })
            qc.invalidateQueries({ queryKey: ['projects'] })
          }}
        />
      )}
      {notesProject && (
        <NotesModal
          project={notesProject}
          onClose={() => setNotesProject(null)}
        />
      )}
    </div>
  )
}

function NotesModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const qc = useQueryClient()
  const [content, setContent] = useState('')

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['project-notes', project.id],
    queryFn: () => adminApi.getProjectNotes(project.id),
  })

  const addNote = useMutation({
    mutationFn: () => adminApi.createProjectNote(project.id, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-notes', project.id] })
      setContent('')
    },
  })

  const deleteNote = useMutation({
    mutationFn: (noteId: string) => adminApi.deleteProjectNote(project.id, noteId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-notes', project.id] }),
  })

  return (
    <Modal open title={`Notatki: ${project.name}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          <textarea
            className="flex-1 bg-bg-input border border-border rounded-lg px-3 py-2 text-text-primary text-sm placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            rows={2}
            placeholder="Dodaj notatkę..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <Button
            size="sm"
            onClick={() => addNote.mutate()}
            loading={addNote.isPending}
            disabled={!content.trim()}
          >
            Dodaj
          </Button>
        </div>

        {isLoading && <p className="text-text-muted text-sm text-center py-4">Ładowanie...</p>}
        {!isLoading && !notes.length && (
          <p className="text-text-muted text-sm text-center py-4">Brak notatek dla tego projektu.</p>
        )}
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {notes.map((n: ProjectNote) => (
            <div key={n.id} className="bg-bg-hover rounded-lg px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-text-primary whitespace-pre-wrap flex-1">{n.content}</p>
                <button
                  onClick={() => deleteNote.mutate(n.id)}
                  className="text-text-muted hover:text-danger transition-colors text-xs shrink-0"
                >
                  ✕
                </button>
              </div>
              <p className="text-xs text-text-muted mt-1.5">
                {n.user.name} · {new Date(n.createdAt).toLocaleString('pl')}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}

function ProjectModal({
  project,
  clients,
  onClose,
  onSaved,
}: {
  project: Project | null
  clients: import('@/types').Client[]
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(project?.name ?? '')
  const [clientId, setClientId] = useState(project?.client.id ?? '')
  const [billingType, setBillingType] = useState<BillingType>(project?.billingType ?? 'HOURLY')
  const [description, setDescription] = useState(project?.description ?? '')
  const [hoursBudget, setHoursBudget] = useState(project?.hoursBudget ? String(project.hoursBudget) : '')

  const clientOptions = clients.map((c) => ({ value: c.id, label: c.name }))
  const billingOptions = [
    { value: 'HOURLY', label: 'Godzinowe (stawka/h)' },
    { value: 'FIXED', label: 'Ryczałt (stała kwota)' },
  ]

  const mut = useMutation({
    mutationFn: () => {
      const budget = hoursBudget ? parseInt(hoursBudget) : undefined
      return project
        ? adminApi.updateProject(project.id, {
            name,
            billingType,
            description: description || undefined,
            hoursBudget: budget ?? null,
          })
        : adminApi.createProject({
            name,
            clientId,
            billingType,
            description: description || undefined,
            hoursBudget: budget,
          })
    },
    onSuccess: onSaved,
  })

  return (
    <Modal
      open
      title={project ? `Edytuj: ${project.name}` : 'Nowy projekt'}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        {!project && (
          <Select
            label="Klient *"
            options={clientOptions}
            placeholder="Wybierz klienta..."
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          />
        )}
        <Input
          label="Nazwa projektu *"
          placeholder="np. Wdrożenie systemu ERP"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Select
          label="Typ rozliczenia *"
          options={billingOptions}
          value={billingType}
          onChange={(e) => setBillingType(e.target.value as BillingType)}
        />
        <Input
          label="Budżet godzinowy (opcjonalny)"
          type="number"
          min="1"
          placeholder="np. 100"
          value={hoursBudget}
          onChange={(e) => setHoursBudget(e.target.value)}
        />
        <Input
          label="Opis (opcjonalny)"
          placeholder="Krótki opis projektu..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="flex gap-3 justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>Anuluj</Button>
          <Button
            onClick={() => mut.mutate()}
            loading={mut.isPending}
            disabled={!name || (!project && !clientId)}
          >
            {project ? 'Zapisz' : 'Utwórz projekt'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
