import { api } from './client'
import type { FakturowniaKontrahent } from '@/types'

export interface FakturowniaConfig {
  configured: boolean
  domain: string
  hasToken: boolean
}

export const settingsApi = {
  getFakturownia: () =>
    api.get<FakturowniaConfig>('/settings/fakturownia').then((r) => r.data),

  saveFakturownia: (dto: { domain: string; apiToken: string }) =>
    api.put<{ ok: boolean }>('/settings/fakturownia', dto).then((r) => r.data),

  getKontrahenci: () =>
    api.get<FakturowniaKontrahent[]>('/settings/fakturownia/kontrahenci').then((r) => r.data),
}
