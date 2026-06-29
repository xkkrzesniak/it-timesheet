import { create } from 'zustand'

interface TimerState {
  running: boolean
  startedAt: number | null   // Date.now() timestamp
  projectId: string | null
  description: string
  elapsedMs: number          // aktualizowany co sekundę przez hook

  start: (projectId: string, description?: string) => void
  stop: () => { minutes: number; startTime: Date; endTime: Date } | null
  setElapsed: (ms: number) => void
  setDescription: (d: string) => void
  setProjectId: (id: string) => void
}

export const useTimerStore = create<TimerState>((set, get) => ({
  running: false,
  startedAt: null,
  projectId: null,
  description: '',
  elapsedMs: 0,

  start: (projectId, description = '') => {
    set({ running: true, startedAt: Date.now(), projectId, description, elapsedMs: 0 })
  },

  stop: () => {
    const { running, startedAt } = get()
    if (!running || !startedAt) return null

    const endTime = new Date()
    const startTime = new Date(startedAt)
    const minutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000)

    set({ running: false, startedAt: null, elapsedMs: 0 })
    return { minutes: Math.max(1, minutes), startTime, endTime }
  },

  setElapsed: (ms) => set({ elapsedMs: ms }),
  setDescription: (description) => set({ description }),
  setProjectId: (projectId) => set({ projectId }),
}))
