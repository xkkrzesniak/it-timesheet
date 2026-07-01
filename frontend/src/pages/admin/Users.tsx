import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/admin'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import type { User, UserProjectRate } from '@/types'

export function AdminUsers() {
  const qc = useQueryClient()
  const [editUser, setEditUser] = useState<User | null>(null)

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: adminApi.getUsers,
  })

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminApi.updateUser(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-text-primary mb-6">Użytkownicy</h1>

      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-text-muted text-xs uppercase tracking-wider">
              <th className="px-4 py-3 text-left">Użytkownik</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-center">Rola</th>
              <th className="px-4 py-3 text-right">Stawka wewnętrzna</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-text-muted">Ładowanie...</td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border/50 hover:bg-bg-hover transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-sm shrink-0">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-text-primary">{u.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-text-secondary">{u.email}</td>
                <td className="px-4 py-3 text-center">
                  <Badge variant={u.role === 'ADMIN' ? 'accent' : 'default'}>{u.role}</Badge>
                </td>
                <td className="px-4 py-3 text-right font-mono text-text-primary font-semibold">
                  {Number(u.hourlyRate).toFixed(2)} zł/h
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge variant={u.isActive ? 'success' : 'danger'}>
                    {u.isActive ? 'Aktywny' : 'Nieaktywny'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditUser(u)}
                    >
                      Edytuj
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleActive.mutate({ id: u.id, isActive: !u.isActive })}
                    >
                      {u.isActive ? 'Dezaktywuj' : 'Aktywuj'}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editUser && (
        <EditUserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={() => {
            setEditUser(null)
            qc.invalidateQueries({ queryKey: ['admin-users'] })
          }}
        />
      )}
    </div>
  )
}

function EditUserModal({
  user,
  onClose,
  onSaved,
}: {
  user: User
  onClose: () => void
  onSaved: () => void
}) {
  const qc = useQueryClient()
  const [name, setName] = useState(user.name)
  const [role, setRole] = useState(user.role)
  const [hourlyRate, setHourlyRate] = useState(String(user.hourlyRate ?? 0))
  const [weeklyGoal, setWeeklyGoal] = useState(user.weeklyGoalHours ? String(user.weeklyGoalHours) : '')
  const [monthlyGoal, setMonthlyGoal] = useState(user.monthlyGoalHours ? String(user.monthlyGoalHours) : '')
  const [newProjectId, setNewProjectId] = useState('')
  const [newRate, setNewRate] = useState('')

  const { data: rates = [] } = useQuery({
    queryKey: ['user-project-rates', user.id],
    queryFn: () => adminApi.getUserProjectRates(user.id),
  })

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => adminApi.getProjects(),
  })

  const update = useMutation({
    mutationFn: () =>
      adminApi.updateUser(user.id, {
        name,
        role,
        hourlyRate: parseFloat(hourlyRate),
        weeklyGoalHours: weeklyGoal ? parseInt(weeklyGoal) : null,
        monthlyGoalHours: monthlyGoal ? parseInt(monthlyGoal) : null,
      }),
    onSuccess: onSaved,
  })

  const addRate = useMutation({
    mutationFn: () =>
      adminApi.upsertProjectRate({ userId: user.id, projectId: newProjectId, hourlyRate: parseFloat(newRate) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-project-rates', user.id] })
      setNewProjectId('')
      setNewRate('')
    },
  })

  const deleteRate = useMutation({
    mutationFn: adminApi.deleteProjectRate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-project-rates', user.id] }),
  })

  const existingProjectIds = new Set(rates.map((r: UserProjectRate) => r.project.id))
  const availableProjects = projects
    .filter((p) => !existingProjectIds.has(p.id))
    .map((p) => ({ value: p.id, label: `${p.client.name} / ${p.name}` }))

  return (
    <Modal open title={`Edytuj: ${user.name}`} onClose={onClose}>
      <div className="flex flex-col gap-5">
        {/* Dane podstawowe */}
        <Input label="Imię i nazwisko" value={name} onChange={(e) => setName(e.target.value)} />
        <Select
          label="Rola"
          options={[{ value: 'USER', label: 'USER' }, { value: 'ADMIN', label: 'ADMIN' }]}
          value={role}
          onChange={(e) => setRole(e.target.value as User['role'])}
        />
        <Input
          label="Stawka globalna (zł/h)"
          type="number" min="0" step="0.01"
          value={hourlyRate}
          onChange={(e) => setHourlyRate(e.target.value)}
        />

        {/* Cele */}
        <div className="border-t border-border pt-4">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Cele godzinowe</p>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Cel tygodniowy (h)"
              type="number" min="1" placeholder="np. 40"
              value={weeklyGoal}
              onChange={(e) => setWeeklyGoal(e.target.value)}
            />
            <Input
              label="Cel miesięczny (h)"
              type="number" min="1" placeholder="np. 160"
              value={monthlyGoal}
              onChange={(e) => setMonthlyGoal(e.target.value)}
            />
          </div>
        </div>

        {/* Stawki projektowe */}
        <div className="border-t border-border pt-4">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Stawki projektowe</p>
          {rates.length > 0 && (
            <div className="space-y-2 mb-3">
              {rates.map((r: UserProjectRate) => (
                <div key={r.id} className="flex items-center justify-between text-xs bg-bg-hover rounded-lg px-3 py-2">
                  <span className="text-text-secondary">
                    <span className="text-text-muted">{r.project.client.name} /</span> {r.project.name}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-semibold text-accent">{Number(r.hourlyRate).toFixed(2)} zł/h</span>
                    <button
                      onClick={() => deleteRate.mutate(r.id)}
                      className="text-text-muted hover:text-danger transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {availableProjects.length > 0 && (
            <div className="flex gap-2">
              <Select
                label=""
                options={availableProjects}
                placeholder="Wybierz projekt..."
                value={newProjectId}
                onChange={(e) => setNewProjectId(e.target.value)}
                className="flex-1"
              />
              <Input
                label=""
                type="number" min="0" step="0.01" placeholder="zł/h"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                className="w-24"
              />
              <div className="flex items-end">
                <Button
                  size="sm"
                  onClick={() => addRate.mutate()}
                  loading={addRate.isPending}
                  disabled={!newProjectId || !newRate}
                >
                  Dodaj
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>Anuluj</Button>
          <Button onClick={() => update.mutate()} loading={update.isPending}>Zapisz</Button>
        </div>
      </div>
    </Modal>
  )
}
