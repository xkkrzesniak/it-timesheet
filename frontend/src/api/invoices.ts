import { api } from './client'
import type { InvoicePreview } from '@/types'

export interface GenerateResult {
  id: number
  url: string
  number: string
}

export const invoicesApi = {
  preview: (params: { clientId: string; from: string; to: string }) =>
    api.get<InvoicePreview>('/invoices/preview', { params }).then((r) => r.data),

  generate: (dto: { clientId: string; from: string; to: string; paymentDays?: number }) =>
    api.post<GenerateResult>('/invoices/generate', dto).then((r) => r.data),
}
