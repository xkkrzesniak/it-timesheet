import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsApi } from '@/api/settings'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'

export function FakturowniaSettings() {
  const qc = useQueryClient()
  const [domain, setDomain] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  const { data: config, isLoading } = useQuery({
    queryKey: ['fakturownia-config'],
    queryFn: settingsApi.getFakturownia,
  })

  useEffect(() => {
    if (config?.domain) setDomain(config.domain)
  }, [config?.domain])

  const save = useMutation({
    mutationFn: () => settingsApi.saveFakturownia({ domain: domain.trim(), apiToken: apiToken.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fakturownia-config'] })
      setApiToken('')
    },
  })

  const test = useMutation({
    mutationFn: settingsApi.getKontrahenci,
    onSuccess: (data) => setTestResult(`OK – znaleziono ${data.length} kontrahentów`),
    onError: () => setTestResult('Błąd – sprawdź domenę i token'),
  })

  if (isLoading) return <div className="p-8 text-text-muted">Ładowanie...</div>

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-2xl font-bold text-text-primary">Fakturownia.pl</h1>
        {config?.configured ? (
          <Badge variant="success">Skonfigurowana</Badge>
        ) : (
          <Badge variant="warning">Nieskonfigurowana</Badge>
        )}
      </div>
      <p className="text-sm text-text-secondary mb-8">
        Dane dostępu przechowywane w bazie danych – nie w plikach konfiguracyjnych ani repozytorium.
      </p>

      <div className="bg-bg-card border border-border rounded-xl p-6 flex flex-col gap-5">
        <div>
          <Input
            label="Subdomena Fakturowni"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="np. powerity"
          />
          <p className="text-xs text-text-muted mt-1">
            Adres konta: <span className="font-mono">{domain || 'twoja-firma'}.fakturownia.pl</span>
          </p>
        </div>

        <div className="relative">
          <Input
            label={config?.configured ? 'Nowy token API (zostaw puste by nie zmieniać)' : 'Token API'}
            type={showToken ? 'text' : 'password'}
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            placeholder={config?.configured ? '••••••••••••••••' : 'Wklej token z ustawień Fakturowni'}
          />
          <button
            type="button"
            onClick={() => setShowToken((v) => !v)}
            className="absolute right-3 bottom-2.5 text-xs text-text-muted hover:text-text-primary"
          >
            {showToken ? 'Ukryj' : 'Pokaż'}
          </button>
        </div>

        {testResult && (
          <div className={`rounded-lg px-4 py-2 text-sm font-medium ${
            testResult.startsWith('OK')
              ? 'bg-green-900/20 text-green-400 border border-green-400/20'
              : 'bg-red-900/20 text-red-400 border border-red-400/20'
          }`}>
            {testResult}
          </div>
        )}

        <div className="flex items-center gap-3 justify-end pt-2">
          <Button
            variant="secondary"
            onClick={() => { setTestResult(null); test.mutate() }}
            loading={test.isPending}
            disabled={!config?.configured}
          >
            Testuj połączenie
          </Button>
          <Button
            onClick={() => save.mutate()}
            loading={save.isPending}
            disabled={!domain || (!apiToken && !config?.configured)}
          >
            Zapisz
          </Button>
        </div>
      </div>

      <div className="mt-6 bg-bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-text-primary mb-2">Jak znaleźć token API?</h2>
        <ol className="text-sm text-text-secondary space-y-1 list-decimal list-inside">
          <li>Zaloguj się do swojego konta na Fakturownia.pl</li>
          <li>Przejdź do <strong>Ustawienia → Ustawienia konta</strong></li>
          <li>Skopiuj wartość z pola <strong>Token do API</strong></li>
        </ol>
      </div>
    </div>
  )
}
