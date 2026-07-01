export type Role = 'ADMIN' | 'USER'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  hourlyRate?: number
  isActive?: boolean
}

export interface Client {
  id: string
  name: string
  isActive: boolean
  hourlyRate?: number  // tylko ADMIN
  createdAt?: string
}

export interface Project {
  id: string
  name: string
  description?: string
  isActive: boolean
  client: Pick<Client, 'id' | 'name'>
}

export interface TimeEntry {
  id: string
  userId: string
  projectId: string
  description?: string
  date: string
  minutes: number
  startTime?: string
  endTime?: string
  snapshotUserRate: number
  costValue: number
  // ADMIN only
  snapshotClientRate?: number
  revenueValue?: number
  user: Pick<User, 'id' | 'name' | 'email'>
  project: {
    id: string
    name: string
    client: Pick<Client, 'id' | 'name'>
  }
  createdAt: string
}

export interface ReportSummary {
  entries: TimeEntry[]
  totalMinutes: number
  totalHours: number
  totalCost: number
  // ADMIN only
  totalRevenue?: number
  totalMargin?: number
  marginPct?: number
}

export interface AdminTimesheets {
  entries: TimeEntry[]
  total: number
  totals: {
    minutes: number
    hours: number
    cost: number
    revenue: number
    margin: number
    marginPct: number
  }
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
}
