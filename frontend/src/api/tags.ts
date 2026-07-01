import { api } from './client'
import type { Tag } from '@/types'

export const tagsApi = {
  getAll: () => api.get<Tag[]>('/tags').then((r) => r.data),
  create: (dto: { name: string; color: string }) =>
    api.post<Tag>('/tags', dto).then((r) => r.data),
  update: (id: string, dto: { name?: string; color?: string }) =>
    api.patch<Tag>(`/tags/${id}`, dto).then((r) => r.data),
  delete: (id: string) => api.delete(`/tags/${id}`),
}
