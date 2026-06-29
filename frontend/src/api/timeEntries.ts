import { api } from './client'
import type { TimeEntry, PaginatedResponse } from '@/types'

export interface CreateTimeEntryDto {
  projectId: string
  date: string
  minutes: number
  description?: string
  startTime?: string
  endTime?: string
}

export const timeEntriesApi = {
  list: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<TimeEntry>>('/time-entries', { params }).then((r) => r.data),

  create: (dto: CreateTimeEntryDto) =>
    api.post<TimeEntry>('/time-entries', dto).then((r) => r.data),

  update: (id: string, dto: Partial<CreateTimeEntryDto>) =>
    api.patch<TimeEntry>(`/time-entries/${id}`, dto).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/time-entries/${id}`),
}
