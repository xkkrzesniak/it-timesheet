import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Role } from '@prisma/client'

const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.nativeEnum(Role).optional(),
  hourlyRate: z.number().nonnegative().optional(),
  isActive: z.boolean().optional(),
})

const adminOpts = { onRequest: [] as any[] }

export async function adminRoutes(app: FastifyInstance) {
  // Wszystkie trasy /api/admin/* chronione podwójnie: authenticate + adminGuard
  const guard = { onRequest: [app.authenticate, app.adminGuard] }

  // GET /api/admin/users — lista wszystkich userów (z hourlyRate)
  app.get('/users', guard, async () => {
    return app.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        hourlyRate: true,
        isActive: true,
        createdAt: true,
        _count: { select: { timeEntries: true } },
      },
      orderBy: { name: 'asc' },
    })
  })

  // PATCH /api/admin/users/:id — edycja stawki i roli usera
  app.patch('/users/:id', guard, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = UpdateUserSchema.parse(request.body)
    try {
      return await app.prisma.user.update({
        where: { id },
        data: body,
        select: { id: true, name: true, email: true, role: true, hourlyRate: true, isActive: true },
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
