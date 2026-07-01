import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Role } from '@prisma/client'

const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.nativeEnum(Role).optional(),
  hourlyRate: z.number().nonnegative().optional(),
  isActive: z.boolean().optional(),
  weeklyGoalHours: z.number().int().positive().nullable().optional(),
  monthlyGoalHours: z.number().int().positive().nullable().optional(),
})

const adminOpts = { onRequest: [] as any[] }

export async function adminRoutes(app: FastifyInstance) {
  // Wszystkie trasy /api/admin/* chronione podwójnie: authenticate + adminGuard
  const guard = { onRequest: [app.authenticate, app.adminGuard] }

  // GET /api/admin/users — lista wszystkich userów
  app.get('/users', guard, async () => {
    return app.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        hourlyRate: true,
        isActive: true,
        weeklyGoalHours: true,
        monthlyGoalHours: true,
        createdAt: true,
        _count: { select: { timeEntries: true } },
      },
      orderBy: { name: 'asc' },
    })
  })

  // GET /api/admin/users/:id/project-rates — stawki projektowe usera
  app.get('/users/:id/project-rates', guard, async (request) => {
    const { id } = request.params as { id: string }
    return app.prisma.userProjectRate.findMany({
      where: { userId: id },
      select: {
        id: true,
        hourlyRate: true,
        project: { select: { id: true, name: true, client: { select: { name: true } } } },
      },
    })
  })

  // PUT /api/admin/project-rates — upsert stawki projektowej
  app.put('/project-rates', guard, async (request, reply) => {
    const { userId, projectId, hourlyRate } = request.body as {
      userId: string; projectId: string; hourlyRate: number
    }
    const rate = await app.prisma.userProjectRate.upsert({
      where: { userId_projectId: { userId, projectId } },
      update: { hourlyRate },
      create: { userId, projectId, hourlyRate },
      select: { id: true, hourlyRate: true, project: { select: { id: true, name: true } } },
    })
    return reply.code(200).send(rate)
  })

  // DELETE /api/admin/project-rates/:id — usuń stawkę projektową
  app.delete('/project-rates/:id', guard, async (request, reply) => {
    const { id } = request.params as { id: string }
    await app.prisma.userProjectRate.delete({ where: { id } })
    return reply.code(204).send()
  })

  // PATCH /api/admin/users/:id — edycja stawki i roli usera
  app.patch('/users/:id', guard, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = UpdateUserSchema.parse(request.body)
    try {
      return await app.prisma.user.update({
        where: { id },
        data: body,
        select: {
          id: true, name: true, email: true, role: true,
          hourlyRate: true, isActive: true,
          weeklyGoalHours: true, monthlyGoalHours: true,
        },
      })
    } catch {
      return reply.code(404).send({ error: 'User not found' })
    }
  })

  // GET /api/admin/timesheets — wszystkie wpisy z danymi finansowymi (ADMIN full view)
  app.get('/timesheets', guard, async (request) => {
    const { from, to, userId, projectId } = request.query as Record<string, string>

    const where: Record<string, unknown> = {
      ...(userId ? { userId } : {}),
      ...(projectId ? { projectId } : {}),
      ...(from || to ? {
        date: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {}),
        },
      } : {}),
    }

    const [total, entries] = await Promise.all([
      app.prisma.timeEntry.count({ where }),
      app.prisma.timeEntry.findMany({
        where,
        select: {
          id: true,
          date: true,
          minutes: true,
          description: true,
          snapshotUserRate: true,
          snapshotClientRate: true,
          costValue: true,
          revenueValue: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
          project: {
            select: {
              name: true,
              client: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
    ])

    const totals = entries.reduce(
      (acc, e) => ({
        minutes: acc.minutes + e.minutes,
        cost: acc.cost + Number(e.costValue),
        revenue: acc.revenue + Number(e.revenueValue),
      }),
      { minutes: 0, cost: 0, revenue: 0 },
    )

    return {
      entries,
      total,
      totals: {
        ...totals,
        hours: parseFloat((totals.minutes / 60).toFixed(2)),
        margin: parseFloat((totals.revenue - totals.cost).toFixed(2)),
        marginPct: totals.revenue > 0
          ? parseFloat(((totals.revenue - totals.cost) / totals.revenue * 100).toFixed(1))
          : 0,
      },
    }
  })
}
