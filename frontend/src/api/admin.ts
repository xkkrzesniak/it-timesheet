import { api } from './client'
import type { User, Client, Project, AdminTimesheets } from '@/types'

export const adminApi = {
  getUsers: () => api.get<User[]>('/admin/users').then((r) => r.data),

  updateUser: (id: string, dto: { role?: User['role']; hourlyRate?: number; isActive?: boolean; name?: string }) =>
    api.patch<User>(`/admin/users/${id}`, dto).then((r) => r.data),

  getTimesheets: (params?: Record<string, string>) =>
    api.get<AdminTimesheets>('/admin/timesheets', { params }).then((r) => r.data),

  // Clients
  getClients: () => api.get<Client[]>('/clients').then((r) => r.data),
  createClient: (dto: { name: string; hourlyRate: number }) =>
    api.post<Client>('/clients', dto).then((r) => r.data),
  updateClient: (id: string, dto: { name?: string; hourlyRate?: number }) =>
    api.patch<Client>(`/clients/${id}`, dto).then((r) => r.data),

  // Projects
  getProjects: (clientId?: string) =>
    api.get<Project[]>('/projects', { params: clientId ? { clientId } : {} }).then((r) => r.data),
  createProject: (dto: { name: string; clientId: string; description?: string; billingType?: string; hoursBudget?: number }) =>
    api.post<Project>('/projects', dto).then((r) => r.data),
  updateProject: (id: string, dto: { name?: string; description?: string; billingType?: string; isActive?: boolean; hoursBudget?: number | null }) =>
    api.patch<Project>(`/projects/${id}`, dto).then((r) => r.data),
  deleteProject: (id: string) =>
    api.delete(`/projects/${id}`),
}
