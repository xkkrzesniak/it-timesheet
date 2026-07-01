import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

const BillingTypeEnum = z.enum(['HOURLY', 'FIXED'])

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  clientId: z.string().cuid(),
  description: z.string().optional(),
  billingType: BillingTypeEnum.default('HOURLY'),
  hoursBudget: z.number().int().positive().optional(),
})

const UpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  billingType: BillingTypeEnum.optional(),
  isActive: z.boolean().optional(),
  hoursBudget: z.number().int().positive().nullable().optional(),
})

const projectSelect = {
  id: true,
  name: true,
  description: true,
  billingType: true,
  hoursBudget: true,
  isActive: true,
  client: { select: { id: true, name: true } },
  createdAt: true,
}

export async function projectsRoutes(app: FastifyInstance) {
  const auth = { onRequest: [app.authenticate] }
  const adminAuth = { onRequest: [app.authenticate, app.adminGuard] }

  // GET /projects — lista projektów (opcjonalnie filtrowana po kliencie)
  app.get('/', auth, async (request) => {
    const { clientId } = request.query as { clientId?: string }
    return app.prisma.project.findMany({
      where: { isActive: true, ...(clientId ? { clientId } : {}) },
      select: projectSelect,
      orderBy: [{ client: { name: 'asc' } }, { name: 'asc' }],
    })
  })

  // POST /projects — utwórz projekt (admin)
  app.post('/', adminAuth, async (request, reply) => {
    const body = CreateSchema.parse(request.body)
    const project = await app.prisma.project.create({ data: body, select: projectSelect })
    return reply.code(201).send(project)
  })

  // PATCH /projects/:id — edytuj projekt (admin)
  app.patch('/:id', adminAuth, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = UpdateSchema.parse(request.body)
    try {
      return await app.prisma.project.update({ where: { id }, data: body, select: projectSelect })
    } catch {
      return reply.code(404).send({ error: 'Not found' })
    }
  })

  // GET /projects/:id/stats — godziny zużyte vs budżet
  app.get('/:id/stats', auth, async (request) => {
    const { id } = request.params as { id: string }
    const [project, aggregate] = await Promise.all([
      app.prisma.project.findUnique({ where: { id }, select: { hoursBudget: true } }),
      app.prisma.timeEntry.aggregate({
        where: { projectId: id },
        _sum: { minutes: true },
      }),
    ])
    const usedHours = parseFloat(((aggregate._sum.minutes ?? 0) / 60).toFixed(2))
    return { hoursBudget: project?.hoursBudget ?? null, usedHours }
  })

  // DELETE /projects/:id — soft delete (admin)
  app.delete('/:id', adminAuth, async (request, reply) => {
    const { id } = request.params as { id: string }
    await app.prisma.project.update({ where: { id }, data: { isActive: false } })
    return reply.code(204).send()
  })
}
