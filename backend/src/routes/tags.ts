import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

const TagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#6B7280'),
})

export async function tagsRoutes(app: FastifyInstance) {
  const auth = { onRequest: [app.authenticate] }
  const adminAuth = { onRequest: [app.authenticate, app.adminGuard] }

  app.get('/', auth, async () =>
    app.prisma.tag.findMany({ orderBy: { name: 'asc' } }),
  )

  app.post('/', adminAuth, async (request, reply) => {
    const body = TagSchema.parse(request.body)
    const tag = await app.prisma.tag.create({ data: body })
    return reply.code(201).send(tag)
  })

  app.patch('/:id', adminAuth, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = TagSchema.partial().parse(request.body)
    try {
      return await app.prisma.tag.update({ where: { id }, data: body })
    } catch {
      return reply.code(404).send({ error: 'Not found' })
    }
  })

  app.delete('/:id', adminAuth, async (request, reply) => {
    const { id } = request.params as { id: string }
    await app.prisma.tag.delete({ where: { id } })
    return reply.code(204).send()
  })
}
