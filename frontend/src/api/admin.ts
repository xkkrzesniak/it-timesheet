import { api } from './client'
import type { User, Client, Project, AdminTimesheets, UserProjectRate, ProjectNote } from '@/types'

export const adminApi = {
  getUsers: () => api.get<User[]>('/admin/users').then((r) => r.data),

  updateUser: (id: string, dto: {
    role?: User['role']; hourlyRate?: number; isActive?: boolean; name?: string;
    weeklyGoalHours?: number | null; monthlyGoalHours?: number | null
  }) =>
    api.patch<User>(`/admin/users/${id}`, dto).then((r) => r.data),

  getUserProjectRates: (userId: string) =>
    api.get<UserProjectRate[]>(`/admin/users/${userId}/project-rates`).then((r) => r.data),
  upsertProjectRate: (dto: { userId: string; projectId: string; hourlyRate: number }) =>
    api.put<UserProjectRate>('/admin/project-rates', dto).then((r) => r.data),
  deleteProjectRate: (id: string) => api.delete(`/admin/project-rates/${id}`),

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

  getProjectStats: (projectId: string) =>
    api.get<{ hoursBudget: number | null; usedHours: number }>(`/projects/${projectId}/stats`).then((r) => r.data),

  // Project notes
  getProjectNotes: (projectId: string) =>
    api.get<ProjectNote[]>(`/projects/${projectId}/notes`).then((r) => r.data),
  createProjectNote: (projectId: string, content: string) =>
    api.post<ProjectNote>(`/projects/${projectId}/notes`, { content }).then((r) => r.data),
  deleteProjectNote: (projectId: string, noteId: string) =>
    api.delete(`/projects/${projectId}/notes/${noteId}`),
}
