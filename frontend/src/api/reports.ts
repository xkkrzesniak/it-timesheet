import { api } from './client'
import type { ReportSummary } from '@/types'

export interface ReportParams {
  from: string
  to: string
  projectId?: string
  userId?: string
}

export const reportsApi = {
  summary: (params: ReportParams) =>
    api.get<ReportSummary>('/reports/summary', { params }).then((r) => r.data),

  exportCsv: async (params: ReportParams) => {
    const response = await api.get('/reports/export/csv', {
      params,
      responseType: 'blob',
    })
    triggerDownload(response.data, `timesheet-${params.from}-${params.to}.csv`, 'text/csv')
  },

  exportPdf: async (params: ReportParams) => {
    const response = await api.get('/reports/export/pdf', {
      params,
      responseType: 'blob',
    })
    triggerDownload(response.data, `timesheet-${params.from}-${params.to}.pdf`, 'application/pdf')
  },
}

function triggerDownload(data: Blob, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function buildQs(params: ReportParams): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]
  return new URLSearchParams(entries).toString()
}
// kept for potential future use
export { buildQs }
