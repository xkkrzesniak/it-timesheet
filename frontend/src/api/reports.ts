import { api } from './client'
import type { ReportSummary } from '@/types'

export interface ReportParams {
  from: string
  to: string
  projectId?: string
  userId?: string
  groupBy?: 'day' | 'project' | 'user'
}

export const reportsApi = {
  summary: (params: ReportParams) =>
    api.get<ReportSummary>('/reports/summary', { params }).then((r) => r.data),

  exportCsv: (params: ReportParams) => {
    const qs = buildQs(params)
    window.open(`/api/reports/export/csv?${qs}`, '_blank')
  },

  exportPdf: (params: ReportParams) => {
    const qs = buildQs(params)
    window.open(`/api/reports/export/pdf?${qs}`, '_blank')
  },
}

function buildQs(params: ReportParams): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]
  return new URLSearchParams(entries).toString()
}
