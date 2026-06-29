import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/admin'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import type { User } from '@/types'

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
  const [name, setName] = useState(user.name)
  const [role, setRole] = useState(user.role)
  const [hourlyRate, setHourlyRate] = useState(String(user.hourlyRate ?? 0))

  const update = useMutation({
    mutationFn: () =>
      adminApi.updateUser(user.id, {
        name,
        role,
        hourlyRate: parseFloat(hourlyRate),
      }),
    onSuccess: onSaved,
  })

  return (
    <Modal open title={`Edytuj: ${user.name}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Input
          label="Imię i nazwisko"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Select
          label="Rola"
          options={[
            { value: 'USER', label: 'USER' },
            { value: 'ADMIN', label: 'ADMIN' },
          ]}
          value={role}
          onChange={(e) => setRole(e.target.value as User['role'])}
        />
        <Input
          label="Stawka wewnętrzna (zł/h)"
          type="number"
          min="0"
          step="0.01"
          value={hourlyRate}
          onChange={(e) => setHourlyRate(e.target.value)}
        />
        <p className="text-xs text-text-muted">
          Stawka wewnętrzna to koszt dla firmy. Widoczna dla użytkownika i ADMINA.
        </p>
        <div className="flex gap-3 justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>Anuluj</Button>
          <Button onClick={() => update.mutate()} loading={update.isPending}>Zapisz</Button>
        </div>
      </div>
    </Modal>
  )
}
