import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  clientId: z.string().cuid(),
  description: z.string().optional(),
})

const UpdateSchema = CreateSchema.partial()

const projectSelect = {
  id: true,
  name: true,
  description: true,
  isActive: true,
  client: { select: { id: true, name: true } },
  createdAt: true,
}

export async function projectsRoutes(app: FastifyInstance) {
  const opts = { onRequest: [app.authenticate] }

  app.get('/', opts, async (request) => {
    const { clientId } = request.query as { clientId?: string }
    return app.prisma.project.findMany({
      where: { isActive: true, ...(clientId ? { clientId } : {}) },
      select: projectSelect,
      orderBy: { name: 'asc' },
    })
  })

  app.post('/', { onRequest: [app.authenticate, app.adminGuard] }, async (request, reply) => {
    const body = CreateSchema.parse(request.body)
    const project = await app.prisma.project.create({ data: body, select: projectSelect })
    return reply.code(201).send(project)
  })

  app.patch('/:id', { onRequest: [app.authenticate, app.adminGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = UpdateSchema.parse(request.body)
    try {
      return await app.prisma.project.update({ where: { id }, data: body, select: projectSelect })
    } catch {
      return reply.code(404).send({ error: 'Not found' })
    }
  })

  app.delete('/:id', { onRequest: [app.authenticate, app.adminGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await app.prisma.project.update({ where: { id }, data: { isActive: false } })
    return reply.code(204).send()
  })
}
