import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Role } from '@prisma/client'
import { clientSelectForRole } from '../middleware/selectByRole.js'

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  hourlyRate: z.number().nonnegative(),
})

const UpdateSchema = CreateSchema.partial()

export async function clientsRoutes(app: FastifyInstance) {
  const opts = { onRequest: [app.authenticate] }

  // GET /api/clients — USER widzi id+name, ADMIN widzi też hourlyRate
  app.get('/', opts, async (request) => {
    const isAdmin = request.user.role === Role.ADMIN
    return app.prisma.client.findMany({
      where: { isActive: true },
      select: clientSelectForRole(request.user.role),
      orderBy: { name: 'asc' },
    })
  })

  // POST /api/clients — ADMIN only
  app.post('/', { onRequest: [app.authenticate, app.adminGuard] }, async (request, reply) => {
    const body = CreateSchema.parse(request.body)
    const client = await app.prisma.client.create({
      data: body,
      select: clientSelectForRole(Role.ADMIN),
    })
    return reply.code(201).send(client)
  })

  // PATCH /api/clients/:id — ADMIN only
  app.patch('/:id', { onRequest: [app.authenticate, app.adminGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = UpdateSchema.parse(request.body)
    try {
      const client = await app.prisma.client.update({
        where: { id },
        data: body,
        select: clientSelectForRole(Role.ADMIN),
      })
      return client
    } catch {
      return reply.code(404).send({ error: 'Not found' })
    }
  })

  // DELETE /api/clients/:id — ADMIN only (soft delete)
  app.delete('/:id', { onRequest: [app.authenticate, app.adminGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await app.prisma.client.update({ where: { id }, data: { isActive: false } })
    return reply.code(204).send()
  })
}
