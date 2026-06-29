import { useEffect } from 'react'
import { useTimerStore } from '@/store/timerStore'

export function useTimer() {
  const store = useTimerStore()

  useEffect(() => {
    if (!store.running || !store.startedAt) return
    const id = setInterval(() => {
      store.setElapsed(Date.now() - store.startedAt!)
    }, 1000)
    return () => clearInterval(id)
  }, [store.running, store.startedAt])

  const formatted = formatDuration(store.elapsedMs)

  return { ...store, formatted }
}

export function formatDuration(ms: number) {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}
