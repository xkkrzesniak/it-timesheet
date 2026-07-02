import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/admin'
import { settingsApi } from '@/api/settings'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import type { Client } from '@/types'

export function AdminClients() {
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editClient, setEditClient] = useState<Client | null>(null)

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients-admin'],
    queryFn: adminApi.getClients,
  })

  const { data: fakturowniaConfig } = useQuery({
    queryKey: ['fakturownia-config'],
    queryFn: settingsApi.getFakturownia,
  })

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Klienci i stawki</h1>
        <Button onClick={() => setModalOpen(true)}>+ Nowy klient</Button>
      </div>

      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-text-muted text-xs uppercase tracking-wider">
              <th className="px-4 py-3 text-left">Klient</th>
              <th className="px-4 py-3 text-right">Stawka sprzedażowa</th>
              {fakturowniaConfig?.configured && (
                <th className="px-4 py-3 text-center">Fakturownia</th>
              )}
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="py-12 text-center text-text-muted">Ładowanie...</td>
              </tr>
            )}
            {clients.map((c) => (
              <tr key={c.id} className="border-b border-border/50 hover:bg-bg-hover transition-colors">
                <td className="px-4 py-3 font-medium text-text-primary">{c.name}</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-accent">
                  {Number(c.hourlyRate).toFixed(2)} zł/h
                </td>
                {fakturowniaConfig?.configured && (
                  <td className="px-4 py-3 text-center">
                    {c.fakturowniaId ? (
                      <Badge variant="success">ID: {c.fakturowniaId}</Badge>
                    ) : (
                      <Badge variant="warning">Niepowiązany</Badge>
                    )}
                  </td>
                )}
                <td className="px-4 py-3 text-center">
                  <Badge variant={c.isActive ? 'success' : 'danger'}>
                    {c.isActive ? 'Aktywny' : 'Nieaktywny'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="sm" onClick={() => setEditClient(c)}>
                    Edytuj
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ClientModal
        open={modalOpen}
        client={null}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          setModalOpen(false)
          qc.invalidateQueries({ queryKey: ['clients-admin'] })
          qc.invalidateQueries({ queryKey: ['clients'] })
        }}
      />

      {editClient && (
        <ClientModal
          open
          client={editClient}
          onClose={() => setEditClient(null)}
          onSaved={() => {
            setEditClient(null)
            qc.invalidateQueries({ queryKey: ['clients-admin'] })
            qc.invalidateQueries({ queryKey: ['clients'] })
          }}
        />
      )}
    </div>
  )
}

function ClientModal({
  open,
  client,
  onClose,
  onSaved,
}: {
  open: boolean
  client: Client | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(client?.name ?? '')
  const [hourlyRate, setHourlyRate] = useState(String(client?.hourlyRate ?? ''))
  const [fakturowniaId, setFakturowniaId] = useState(client?.fakturowniaId ?? '')
  const [linkMode, setLinkMode] = useState<'manual' | 'search'>('manual')

  const { data: fakturowniaConfig } = useQuery({
    queryKey: ['fakturownia-config'],
    queryFn: settingsApi.getFakturownia,
  })

  const { data: kontrahenci = [], isFetching: loadingKontrahenci } = useQuery({
    queryKey: ['fakturownia-kontrahenci'],
    queryFn: settingsApi.getKontrahenci,
    enabled: fakturowniaConfig?.configured === true && linkMode === 'search',
    staleTime: 60_000,
  })

  const save = useMutation({
    mutationFn: () =>
      client
        ? adminApi.updateClient(client.id, {
            name,
            hourlyRate: parseFloat(hourlyRate),
            fakturowniaId: fakturowniaId || null,
          })
        : adminApi.createClient({ name, hourlyRate: parseFloat(hourlyRate) }),
    onSuccess: onSaved,
  })

  return (
    <Modal open={open} title={client ? `Edytuj: ${client.name}` : 'Nowy klient'} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Input
          label="Nazwa klienta"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Np. Acme Corp"
        />
        <Input
          label="Stawka sprzedażowa (zł/h)"
          type="number"
          min="0"
          step="0.01"
          value={hourlyRate}
          onChange={(e) => setHourlyRate(e.target.value)}
          placeholder="0.00"
        />

        {fakturowniaConfig?.configured && client && (
          <div className="border border-border rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-text-primary">Powiązanie z Fakturownią</p>
              <div className="flex gap-1 text-xs">
                <button
                  onClick={() => setLinkMode('manual')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${linkMode === 'manual' ? 'bg-accent text-white' : 'text-text-muted hover:text-text-primary'}`}
                >
                  Ręcznie
                </button>
                <button
                  onClick={() => setLinkMode('search')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${linkMode === 'search' ? 'bg-accent text-white' : 'text-text-muted hover:text-text-primary'}`}
                >
                  Lista kontrahentów
                </button>
              </div>
            </div>

            {linkMode === 'manual' ? (
              <Input
                label="ID kontrahenta w Fakturowni"
                value={fakturowniaId ?? ''}
                onChange={(e) => setFakturowniaId(e.target.value)}
                placeholder="Np. 12345678"
              />
            ) : (
              <div>
                {loadingKontrahenci ? (
                  <p className="text-sm text-text-muted">Ładowanie kontrahentów...</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                    {kontrahenci.length === 0 && (
                      <p className="text-sm text-text-muted p-3">Brak kontrahentów</p>
                    )}
                    {kontrahenci.map((k) => (
                      <button
                        key={k.id}
                        onClick={() => setFakturowniaId(k.id)}
                        className={`w-full text-left px-3 py-2.5 hover:bg-bg-hover transition-colors text-sm ${
                          fakturowniaId === k.id ? 'bg-accent-light text-accent' : 'text-text-primary'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{k.name}</span>
                          <span className="text-xs text-text-muted">ID: {k.id}</span>
                        </div>
                        {k.nip && <span className="text-xs text-text-muted">NIP: {k.nip}</span>}
                        {k.email && <span className="block text-xs text-text-muted">{k.email}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {fakturowniaId && (
                  <p className="text-xs text-accent mt-2">Wybrany kontrahent ID: {fakturowniaId}</p>
                )}
              </div>
            )}

            {fakturowniaId && (
              <button
                onClick={() => setFakturowniaId('')}
                className="text-xs text-danger hover:underline self-start"
              >
                Usuń powiązanie
              </button>
            )}
          </div>
        )}

        <div className="rounded-lg bg-accent-light border border-accent/20 p-3">
          <p className="text-xs text-accent">
            Stawka sprzedażowa jest widoczna <strong>wyłącznie dla ADMINA</strong>.
            Użytkownicy nie widzą tej wartości.
          </p>
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>Anuluj</Button>
          <Button
            onClick={() => save.mutate()}
            loading={save.isPending}
            disabled={!name || !hourlyRate}
          >
            {client ? 'Zapisz' : 'Utwórz'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
