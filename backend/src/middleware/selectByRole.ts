import { Role } from '@prisma/client'
import type { JwtPayload } from '../plugins/auth.js'

/**
 * Zwraca listę pól TimeEntry do SELECT zależnie od roli.
 * USER nigdy nie dostaje snapshotClientRate ani revenueValue.
 * Logika widoczności WYŁĄCZNIE tutaj — frontend nie decyduje.
 */
export function timeEntrySelectForRole(role: Role) {
  const base = {
    id: true,
    userId: true,
    projectId: true,
    description: true,
    date: true,
    startTime: true,
    endTime: true,
    minutes: true,
    snapshotUserRate: true,
    costValue: true,
    createdAt: true,
    updatedAt: true,
    project: {
      select: {
        id: true,
        name: true,
        client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    },
    user: {
      select: {
        id: true,
        name: true,
        email: true,
      },
    },
    tag: {
      select: { id: true, name: true, color: true },
    },
  }

  if (role === Role.ADMIN) {
    return {
      ...base,
      snapshotClientRate: true,
      revenueValue: true,
    }
  }

  return base
}

/**
 * Filtr WHERE dla TimeEntry.
 * USER widzi tylko własne wpisy.
 */
export function timeEntryWhereForUser(caller: Pick<JwtPayload, 'sub' | 'role'>, overrideUserId?: string) {
  if (caller.role === Role.ADMIN) {
    return overrideUserId ? { userId: overrideUserId } : {}
  }
  // USER zawsze ograniczony do własnych wpisów
  return { userId: caller.sub }
}

/**
 * Pola Client widoczne dla roli.
 * hourlyRate (stawka sprzedażowa) — ADMIN only.
 */
export function clientSelectForRole(role: Role) {
  const base = { id: true, name: true, isActive: true }
  if (role === Role.ADMIN) {
    return { ...base, hourlyRate: true, createdAt: true, updatedAt: true }
  }
  return base
}

/**
 * Pola User widoczne dla roli.
 * hourlyRate — widoczny dla samego usera i ADMINA.
 */
export function userSelectForRole(role: Role, requestedUserId: string, callerId: string) {
  const base = { id: true, name: true, email: true, role: true, isActive: true }
  const withRate = { ...base, hourlyRate: true }

  if (role === Role.ADMIN) return { ...withRate, azureOid: true, createdAt: true }
  // USER widzi własną stawkę
  if (requestedUserId === callerId) return withRate
  return base
}
