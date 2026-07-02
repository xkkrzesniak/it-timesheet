import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { format, startOfMonth, addDays } from 'date-fns'
import { reportsApi } from '@/api/reports'
import { adminApi } from '@/api/admin'
import { settingsApi } from '@/api/settings'
import { invoicesApi } from '@/api/invoices'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { StatCard } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { InvoicePreview } from '@/types'

export function Reports() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ADMIN'

  const [from, setFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [projectId, setProjectId] = useState('')
  const [clientId, setClientId] = useState('')
  const [userId, setUserId] = useState('')
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null)
  const [invoiceModal, setInvoiceModal] = useState(false)

  const params = {
    from,
    to,
    ...(projectId ? { projectId } : {}),
    ...(isAdmin && clientId ? { clientId } : {}),
    ...(userId ? { userId } : {}),
  }

  const { data, isLoading } = useQuery({
    queryKey: ['reports', params],
    queryFn: () => reportsApi.summary(params),
  })

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => adminApi.getProjects(),
  })

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-admin'],
    queryFn: adminApi.getClients,
    enabled: isAdmin,
  })

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.getUsers(),
    enabled: isAdmin,
  })

  const { data: fakturowniaConfig } = useQuery({
    queryKey: ['fakturownia-config'],
    queryFn: settingsApi.getFakturownia,
    enabled: isAdmin,
  })

  const projectOptions = projects.map((p) => ({ value: p.id, label: `${p.client.name} / ${p.name}` }))
  const clientOptions = clients.map((c) => ({ value: c.id, label: c.name }))
  const userOptions = users.map((u) => ({ value: u.id, label: u.name }))

  const handleExport = async (type: 'csv' | 'pdf') => {
    setExporting(type)
    try {
      if (type === 'csv') await reportsApi.exportCsv(params)
      else await reportsApi.exportPdf(params)
    } finally {
      setExporting(null)
    }
  }

  const showInvoiceButton = isAdmin && fakturowniaConfig?.configured && clientId

  const cols = isAdmin ? 10 : 6

  return (
    <div className="p-6 max-w-full mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Raporty</h1>
        <div className="flex gap-2">
          {showInvoiceButton && (
            <Button
              size="sm"
              onClick={() => setInvoiceModal(true)}
            >
              Wystaw FV
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            loading={exporting === 'csv'}
            onClick={() => handleExport('csv')}
          >
            Eksport CSV
          </Button>
          <Button
            variant="secondary"
            size="sm"
            loading={exporting === 'pdf'}
            onClick={() => handleExport('pdf')}
          >
            Eksport PDF
          </Button>
        </div>
      </div>

      {/* Filtry */}
      <div className="flex flex-wrap gap-3 mb-6 bg-bg-card border border-border rounded-xl p-4">
        <Input label="Od" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36" />
        <Input label="Do" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36" />
        {isAdmin && (
          <Select
            label="Klient"
            options={clientOptions}
            placeholder="Wszyscy"
            value={clientId}
            onChange={(e) => { setClientId(e.target.value); setProjectId('') }}
            className="w-44"
          />
        )}
        <Select
          label="Projekt"
          options={projectOptions}
          placeholder="Wszystkie"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="w-52"
        />
        {isAdmin && (
          <Select
            label="Użytkownik"
            options={userOptions}
            placeholder="Wszyscy"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="w-44"
          />
        )}
      </div>

      {/* KPI */}
      <div className={`grid gap-4 mb-6 ${isAdmin ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 lg:grid-cols-3'}`}>
        <StatCard label="Łącznie godzin" value={isLoading ? '...' : `${data?.totalHours ?? 0} h`} accent />
        <StatCard label="Koszt własny" value={isLoading ? '...' : `${data?.totalCost?.toFixed(2) ?? 0} zł`} />
        {isAdmin && (
          <>
            <StatCard label="Przychód" value={isLoading ? '...' : `${data?.totalRevenue?.toFixed(2) ?? 0} zł`} accent />
            <StatCard
              label="Marża"
              value={isLoading ? '...' : `${data?.totalMargin?.toFixed(2) ?? 0} zł`}
              sub={`${data?.marginPct ?? 0}%`}
            />
          </>
        )}
      </div>

      {/* Tabela */}
      <div className="bg-bg-card border border-border rounded-xl overflow-x-auto">
        <table className="text-xs w-full" style={{ minWidth: isAdmin ? '900px' : '600px' }}>
          <thead>
            <tr className="border-b border-border text-text-muted uppercase tracking-wider">
              <th className="px-3 py-3 text-left whitespace-nowrap">Data</th>
              {isAdmin && <th className="px-3 py-3 text-left whitespace-nowrap">Pracownik</th>}
              <th className="px-3 py-3 text-left whitespace-nowrap">Klient / Projekt</th>
              <th className="px-3 py-3 text-left">Opis</th>
              <th className="px-3 py-3 text-right whitespace-nowrap">Czas</th>
              <th className="px-3 py-3 text-right whitespace-nowrap">St.wł.</th>
              <th className="px-3 py-3 text-right whitespace-nowrap">Koszt</th>
              {isAdmin && (
                <>
                  <th className="px-3 py-3 text-right whitespace-nowrap">St.kl.</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap">Przychód</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap">Marża</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={cols} className="py-12 text-center text-text-muted">Ładowanie...</td>
              </tr>
            )}
            {data?.entries.map((e) => {
              const hours = (e.minutes / 60).toFixed(2)
              const margin = isAdmin ? Number(e.revenueValue) - Number(e.costValue) : 0
              return (
                <tr key={e.id} className="border-b border-border/50 hover:bg-bg-hover transition-colors">
                  <td className="px-3 py-2.5 text-text-muted whitespace-nowrap">{e.date.slice(0, 10)}</td>
                  {isAdmin && <td className="px-3 py-2.5 text-text-primary whitespace-nowrap">{e.user.name}</td>}
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="text-text-muted block text-[10px]">{e.project.client.name}</span>
                    <span className="text-text-primary font-medium">{e.project.name}</span>
                  </td>
                  <td className="px-3 py-2.5 text-text-secondary max-w-[150px] truncate">{e.description ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-accent font-semibold whitespace-nowrap">{hours} h</td>
                  <td className="px-3 py-2.5 text-right text-text-secondary whitespace-nowrap">{Number(e.snapshotUserRate)} zł/h</td>
                  <td className="px-3 py-2.5 text-right text-text-primary whitespace-nowrap">{Number(e.costValue).toFixed(2)} zł</td>
                  {isAdmin && (
                    <>
                      <td className="px-3 py-2.5 text-right text-text-secondary whitespace-nowrap">{Number(e.snapshotClientRate)} zł/h</td>
                      <td className="px-3 py-2.5 text-right text-text-primary whitespace-nowrap">{Number(e.revenueValue).toFixed(2)} zł</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <Badge variant={margin >= 0 ? 'success' : 'danger'}>
                          {margin.toFixed(2)} zł
                        </Badge>
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
            {!isLoading && !data?.entries.length && (
              <tr>
                <td colSpan={cols} className="py-12 text-center text-text-muted">
                  Brak danych w wybranym okresie
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {invoiceModal && clientId && (
        <InvoiceModal
          clientId={clientId}
          clientName={clients.find((c) => c.id === clientId)?.name ?? ''}
          from={from}
          to={to}
          onClose={() => setInvoiceModal(false)}
        />
      )}
    </div>
  )
}

function InvoiceModal({
  clientId,
  clientName,
  from,
  to,
  onClose,
}: {
  clientId: string
  clientName: string
  from: string
  to: string
  onClose: () => void
}) {
  const [paymentDays, setPaymentDays] = useState(14)
  const [result, setResult] = useState<{ id: number; url: string; number: string } | null>(null)

  const { data: preview, isLoading, error } = useQuery({
    queryKey: ['invoice-preview', clientId, from, to],
    queryFn: () => invoicesApi.preview({ clientId, from, to }),
    retry: false,
  })

  const generate = useMutation({
    mutationFn: () => invoicesApi.generate({ clientId, from, to, paymentDays }),
    onSuccess: (data) => setResult(data),
  })

  const paymentDate = addDays(new Date(), paymentDays)

  return (
    <Modal open title={`Faktura — ${clientName}`} onClose={onClose}>
      {result ? (
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center text-success text-2xl">✓</div>
          <div className="text-center">
            <p className="font-semibold text-text-primary text-lg">Faktura wystawiona!</p>
            <p className="text-text-muted text-sm mt-1">Numer: {result.number}</p>
          </div>
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-accent text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            Otwórz fakturę w Fakturowni →
          </a>
          <button onClick={onClose} className="text-sm text-text-muted hover:text-text-primary">
            Zamknij
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Period info */}
          <div className="flex gap-4 text-sm">
            <div>
              <span className="text-text-muted text-xs block">Okres</span>
              <span className="font-medium text-text-primary">{from} – {to}</span>
            </div>
            <div>
              <span className="text-text-muted text-xs block">Data wystawienia</span>
              <span className="font-medium text-text-primary">{format(new Date(), 'yyyy-MM-dd')}</span>
            </div>
          </div>

          {/* Payment days */}
          <div className="flex items-center gap-3">
            <label className="text-sm text-text-secondary whitespace-nowrap">Termin płatności (dni):</label>
            <input
              type="number"
              min={1}
              max={90}
              value={paymentDays}
              onChange={(e) => setPaymentDays(parseInt(e.target.value) || 14)}
              className="w-20 bg-bg-input border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <span className="text-xs text-text-muted">→ {format(paymentDate, 'yyyy-MM-dd')}</span>
          </div>

          {/* Preview table */}
          {isLoading && (
            <p className="text-sm text-text-muted text-center py-4">Ładowanie podglądu...</p>
          )}

          {error && (
            <div className="bg-danger/10 border border-danger/20 rounded-lg p-3 text-sm text-danger">
              {(error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Błąd ładowania podglądu'}
            </div>
          )}

          {preview && (
            <>
              {!preview.client.fakturowniaId && (
                <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 text-xs text-warning">
                  Klient nie jest powiązany z kontrahentem w Fakturowni. Faktura zostanie wystawiona z nazwą klienta ({preview.client.name}).
                </div>
              )}

              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-bg-hover text-xs text-text-muted uppercase tracking-wider">
                      <th className="px-3 py-2 text-left">Projekt</th>
                      <th className="px-3 py-2 text-right">Godziny</th>
                      <th className="px-3 py-2 text-right">Stawka</th>
                      <th className="px-3 py-2 text-right">Netto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.positions.map((p) => (
                      <tr key={p.name} className="border-t border-border">
                        <td className="px-3 py-2.5 font-medium text-text-primary">{p.name}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-text-primary">{p.hours.toFixed(2)} h</td>
                        <td className="px-3 py-2.5 text-right text-text-secondary">{p.priceNet.toFixed(2)} zł/h</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-text-primary">{p.totalNet.toFixed(2)} zł</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-border bg-bg-hover">
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-sm text-right text-text-muted">Netto:</td>
                      <td className="px-3 py-2 text-right font-semibold text-text-primary">{preview.totalNet.toFixed(2)} zł</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-sm text-right text-text-muted">VAT 23%:</td>
                      <td className="px-3 py-2 text-right text-text-primary">{preview.vat.toFixed(2)} zł</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-base text-right font-bold text-text-primary">Brutto:</td>
                      <td className="px-3 py-2 text-right font-bold text-accent text-base">{preview.totalGross.toFixed(2)} zł</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}

          {generate.error && (
            <div className="bg-danger/10 border border-danger/20 rounded-lg p-3 text-sm text-danger">
              {(generate.error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Błąd wystawiania faktury'}
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={onClose}>Anuluj</Button>
            <Button
              onClick={() => generate.mutate()}
              loading={generate.isPending}
              disabled={!preview || isLoading}
            >
              Wystaw fakturę
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
