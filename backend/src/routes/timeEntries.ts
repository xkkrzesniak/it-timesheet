import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { timeEntrySelectForRole, timeEntryWhereForUser } from '../middleware/selectByRole.js'

const CreateSchema = z.object({
  projectId: z.string().cuid(),
  description: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  minutes: z.number().int().positive().max(1440),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  tagId: z.string().optional().nullable(),
})

const UpdateSchema = CreateSchema.partial().omit({ projectId: true })

const ListQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  projectId: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
})

export async function timeEntriesRoutes(app: FastifyInstance) {
  const opts = { onRequest: [app.authenticate] }

  // GET /api/time-entries
  app.get('/', opts, async (request) => {
    const q = ListQuerySchema.parse(request.query)
    const caller = request.user

    const where: Record<string, unknown> = {
      ...timeEntryWhereForUser(caller),
      ...(q.from || q.to ? {
        date: {
          ...(q.from ? { gte: new Date(q.from) } : {}),
          ...(q.to ? { lte: new Date(q.to) } : {}),
        },
      } : {}),
      ...(q.projectId ? { projectId: q.projectId } : {}),
    }

    const [total, items] = await Promise.all([
      app.prisma.timeEntry.count({ where }),
      app.prisma.timeEntry.findMany({
        where,
        select: timeEntrySelectForRole(caller.role),
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
    ])

    return { items, total, page: q.page, limit: q.limit }
  })

  // GET /api/time-entries/:id
  app.get('/:id', opts, async (request, reply) => {
    const { id } = request.params as { id: string }
    const caller = request.user

    const entry = await app.prisma.timeEntry.findFirst({
      where: { id, ...timeEntryWhereForUser(caller) },
      select: timeEntrySelectForRole(caller.role),
    })

    if (!entry) return reply.code(404).send({ error: 'Not found' })
    return entry
  })

  // POST /api/time-entries
  app.post('/', opts, async (request, reply) => {
    const body = CreateSchema.parse(request.body)
    const caller = request.user

    // Pobierz stawki z bazy — snapshot w momencie zapisu
    const [user, project, projectRate] = await Promise.all([
      app.prisma.user.findUnique({ where: { id: caller.sub }, select: { hourlyRate: true } }),
      app.prisma.project.findUnique({
        where: { id: body.projectId },
        select: { clientId: true, client: { select: { hourlyRate: true } } },
      }),
      app.prisma.userProjectRate.findUnique({
        where: { userId_projectId: { userId: caller.sub, projectId: body.projectId } },
        select: { hourlyRate: true },
      }),
    ])

    if (!user) return reply.code(404).send({ error: 'User not found' })
    if (!project) return reply.code(404).send({ error: 'Project not found' })

    // Stawka projektowa (jeśli ustawiona) bierze pierwszeństwo nad globalną
    const snapshotUserRate = Number(projectRate?.hourlyRate ?? user.hourlyRate)
    const snapshotClientRate = Number(project.client.hourlyRate)
    const hours = body.minutes / 60

    const entry = await app.prisma.timeEntry.create({
      data: {
        userId: caller.sub,
        projectId: body.projectId,
        description: body.description,
        date: new Date(body.date),
        minutes: body.minutes,
        startTime: body.startTime ? new Date(body.startTime) : null,
        endTime: body.endTime ? new Date(body.endTime) : null,
        tagId: body.tagId ?? null,
        snapshotUserRate,
        snapshotClientRate,
        costValue: parseFloat((hours * snapshotUserRate).toFixed(2)),
        revenueValue: parseFloat((hours * snapshotClientRate).toFixed(2)),
      },
      select: timeEntrySelectForRole(caller.role),
    })

    return reply.code(201).send(entry)
  })

  // PATCH /api/time-entries/:id
  app.patch('/:id', opts, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = UpdateSchema.parse(request.body)
    const caller = request.user

    const existing = await app.prisma.timeEntry.findFirst({
      where: { id, ...timeEntryWhereForUser(caller) },
    })
    if (!existing) return reply.code(404).send({ error: 'Not found' })

    // Jeśli zmienia się liczba minut — przelicz wartości
    const minutes = body.minutes ?? existing.minutes
    const hours = minutes / 60
    const costValue = parseFloat((hours * Number(existing.snapshotUserRate)).toFixed(2))
    const revenueValue = parseFloat((hours * Number(existing.snapshotClientRate)).toFixed(2))

    const updated = await app.prisma.timeEntry.update({
      where: { id },
      data: {
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.date ? { date: new Date(body.date) } : {}),
        ...(body.minutes ? { minutes, costValue, revenueValue } : {}),
        ...(body.startTime ? { startTime: new Date(body.startTime) } : {}),
        ...(body.endTime ? { endTime: new Date(body.endTime) } : {}),
        ...(body.tagId !== undefined ? { tagId: body.tagId ?? null } : {}),
      },
      select: timeEntrySelectForRole(caller.role),
    })

    return updated
  })

  // DELETE /api/time-entries/:id
  app.delete('/:id', opts, async (request, reply) => {
    const { id } = request.params as { id: string }
    const caller = request.user

    const existing = await app.prisma.timeEntry.findFirst({
      where: { id, ...timeEntryWhereForUser(caller) },
    })
    if (!existing) return reply.code(404).send({ error: 'Not found' })

    await app.prisma.timeEntry.delete({ where: { id } })
    return reply.code(204).send()
  })
}
