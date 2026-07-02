export type Role = 'ADMIN' | 'USER'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  hourlyRate?: number
  isActive?: boolean
  weeklyGoalHours?: number | null
  monthlyGoalHours?: number | null
}

export interface Tag {
  id: string
  name: string
  color: string
}

export interface UserProjectRate {
  id: string
  hourlyRate: number
  project: { id: string; name: string; client: { name: string } }
}

export interface Client {
  id: string
  name: string
  isActive: boolean
  hourlyRate?: number       // tylko ADMIN
  fakturowniaId?: string | null  // tylko ADMIN
  createdAt?: string
}

export interface FakturowniaKontrahent {
  id: string
  name: string
  email: string
  nip: string
}

export interface InvoicePreview {
  client: { name: string; fakturowniaId: string | null }
  positions: { name: string; hours: number; priceNet: number; totalNet: number }[]
  totalNet: number
  vat: number
  totalGross: number
  rate: number
  issueDate: string
  sellDate: string
}

export type BillingType = 'HOURLY' | 'FIXED'

export interface Project {
  id: string
  name: string
  description?: string
  billingType: BillingType
  hoursBudget?: number | null
  isActive: boolean
  client: Pick<Client, 'id' | 'name'>
  createdAt?: string
}

export interface DashboardStats {
  thisWeek: { hours: number; cost: number }
  lastWeek: { hours: number; cost: number }
  thisMonth: { hours: number; cost: number }
  lastMonth: { hours: number; cost: number }
  topClients: { name: string; hours: number; cost: number }[]
  topProjects: { name: string; clientName: string; hours: number }[]
  weeklyGoalHours: number | null
  monthlyGoalHours: number | null
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
  tagId?: string | null
  tag?: Tag | null
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

export interface ProjectNote {
  id: string
  content: string
  createdAt: string
  user: Pick<User, 'id' | 'name'>
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
