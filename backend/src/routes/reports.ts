import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Role } from '@prisma/client'
import { stringify } from 'csv-stringify/sync'
import { timeEntryWhereForUser } from '../middleware/selectByRole.js'
import { generatePdf } from '../services/pdfExport.js'

const ReportQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  projectId: z.string().optional(),
  clientId: z.string().optional(), // ADMIN może filtrować po kliencie
  userId: z.string().optional(), // ADMIN może filtrować po userze
  groupBy: z.enum(['day', 'project', 'user']).default('day'),
})

export async function reportsRoutes(app: FastifyInstance) {
  const opts = { onRequest: [app.authenticate] }

  // GET /api/reports/summary — podsumowanie z kolumnami zależnymi od roli
  app.get('/summary', opts, async (request) => {
    const q = ReportQuerySchema.parse(request.query)
    const caller = request.user
    const isAdmin = caller.role === Role.ADMIN

    const where: Record<string, unknown> = {
      ...timeEntryWhereForUser(caller, isAdmin ? q.userId : undefined),
      date: { gte: new Date(q.from), lte: new Date(q.to) },
      ...(q.projectId ? { projectId: q.projectId } : {}),
      ...(isAdmin && q.clientId ? { project: { clientId: q.clientId } } : {}),
    }

    const entries = await app.prisma.timeEntry.findMany({
      where,
      select: {
        id: true,
        date: true,
        minutes: true,
        description: true,
        snapshotUserRate: true,
        costValue: true,
        // Krytyczne: snapshotClientRate i revenueValue TYLKO dla ADMINA
        ...(isAdmin ? { snapshotClientRate: true, revenueValue: true } : {}),
        user: { select: { id: true, name: true } },
        project: {
          select: {
            id: true,
            name: true,
            client: {
              select: {
                id: true,
                name: true,
                // hourlyRate klienta — NIGDY dla USER
              },
            },
          },
        },
      },
      orderBy: [{ date: 'asc' }],
    })

    const totalMinutes = entries.reduce((s, e) => s + e.minutes, 0)
    const totalCost = entries.reduce((s, e) => s + Number(e.costValue), 0)

    const summary: Record<string, unknown> = {
      entries,
      totalMinutes,
      totalHours: parseFloat((totalMinutes / 60).toFixed(2)),
      totalCost: parseFloat(totalCost.toFixed(2)),
    }

    if (isAdmin) {
      const totalRevenue = entries.reduce((s, e) => s + Number((e as any).revenueValue ?? 0), 0)
      summary.totalRevenue = parseFloat(totalRevenue.toFixed(2))
      summary.totalMargin = parseFloat((totalRevenue - totalCost).toFixed(2))
      summary.marginPct = totalRevenue > 0
        ? parseFloat(((totalRevenue - totalCost) / totalRevenue * 100).toFixed(1))
        : 0
    }

    return summary
  })

  // GET /api/reports/export/csv
  app.get('/export/csv', opts, async (request, reply) => {
    const q = ReportQuerySchema.parse(request.query)
    const caller = request.user
    const isAdmin = caller.role === Role.ADMIN

    const entries = await fetchReportEntries(app, caller, q, isAdmin)

    const rows = entries.map((e) => {
      const base = {
        'Data': formatDate(e.date),
        'Użytkownik': e.user.name,
        'Klient': e.project.client.name,
        'Projekt': e.project.name,
        'Opis': e.description ?? '',
        'Minuty': e.minutes,
        'Godziny': parseFloat((e.minutes / 60).toFixed(2)),
        'Stawka własna': Number(e.snapshotUserRate),
        'Wartość (koszt)': Number(e.costValue),
      }
      if (isAdmin) {
        return {
          ...base,
          'Stawka klienta': Number((e as any).snapshotClientRate),
          'Przychód': Number((e as any).revenueValue),
          'Marża': parseFloat((Number((e as any).revenueValue) - Number(e.costValue)).toFixed(2)),
        }
      }
      return base
    })

    const csv = stringify(rows, { header: true })
    reply.header('Content-Type', 'text/csv; charset=utf-8')
    reply.header('Content-Disposition', `attachment; filename="timesheet-${q.from}-${q.to}.csv"`)
    return reply.send('﻿' + csv) // BOM dla Excel
  })

  // GET /api/reports/export/pdf
  app.get('/export/pdf', opts, async (request, reply) => {
    const q = ReportQuerySchema.parse(request.query)
    const caller = request.user
    const isAdmin = caller.role === Role.ADMIN

    const entries = await fetchReportEntries(app, caller, q, isAdmin)
    const pdfBuffer = await generatePdf(entries, caller, q.from, q.to, isAdmin)

    reply.header('Content-Type', 'application/pdf')
    reply.header('Content-Disposition', `attachment; filename="timesheet-${q.from}-${q.to}.pdf"`)
    return reply.send(pdfBuffer)
  })
}

async function fetchReportEntries(
  app: FastifyInstance,
  caller: { sub: string; role: Role },
  q: z.infer<typeof ReportQuerySchema>,
  isAdmin: boolean,
) {
  const where: Record<string, unknown> = {
    ...timeEntryWhereForUser(caller, isAdmin ? q.userId : undefined),
    date: { gte: new Date(q.from), lte: new Date(q.to) },
    ...(q.projectId ? { projectId: q.projectId } : {}),
    ...(isAdmin && q.clientId ? { project: { clientId: q.clientId } } : {}),
  }

  return app.prisma.timeEntry.findMany({
    where,
    select: {
      id: true,
      date: true,
      minutes: true,
      description: true,
      snapshotUserRate: true,
      costValue: true,
      ...(isAdmin ? { snapshotClientRate: true, revenueValue: true } : {}),
      user: { select: { id: true, name: true } },
      project: {
        select: {
          name: true,
          client: { select: { name: true } },
        },
      },
    },
    orderBy: [{ date: 'asc' }],
  })
}

function formatDate(d: Date) {
  return d.toISOString().split('T')[0]
}
