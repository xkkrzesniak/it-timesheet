import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/admin'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import type { Project, BillingType } from '@/types'

const BILLING_LABELS: Record<BillingType, string> = {
  HOURLY: 'Godzinowe',
  FIXED: 'Ryczałt',
}

export function AdminProjects() {
  const qc = useQueryClient()
  const [filterClient, setFilterClient] = useState('')
  const [modal, setModal] = useState<{ open: boolean; project: Project | null }>({
    open: false,
    project: null,
  })

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
                  <Badge variant={p.billingType === 'HOURLY' ? 'info' : 'success'}>
                    {BILLING_LABELS[p.billingType]}
                  </Badge>
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
    </div>
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

  const clientOptions = clients.map((c) => ({ value: c.id, label: c.name }))
  const billingOptions = [
    { value: 'HOURLY', label: 'Godzinowe (stawka/h)' },
    { value: 'FIXED', label: 'Ryczałt (stała kwota)' },
  ]

  const mut = useMutation({
    mutationFn: () =>
      project
        ? adminApi.updateProject(project.id, { name, billingType, description: description || undefined })
        : adminApi.createProject({ name, clientId, billingType, description: description || undefined }),
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
