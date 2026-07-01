import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

const NoteSchema = z.object({ content: z.string().min(1).max(2000) })

export async function projectNotesRoutes(app: FastifyInstance) {
  const adminAuth = { onRequest: [app.authenticate, app.adminGuard] }

  app.get('/:projectId/notes', adminAuth, async (request) => {
    const { projectId } = request.params as { projectId: string }
    return app.prisma.projectNote.findMany({
      where: { projectId },
      select: {
        id: true,
        content: true,
        createdAt: true,
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  })

  app.post('/:projectId/notes', adminAuth, async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const { content } = NoteSchema.parse(request.body)
    const note = await app.prisma.projectNote.create({
      data: { projectId, userId: request.user.sub, content },
      select: {
        id: true,
        content: true,
        createdAt: true,
        user: { select: { id: true, name: true } },
      },
    })
    return reply.code(201).send(note)
  })

  app.delete('/:projectId/notes/:noteId', adminAuth, async (request, reply) => {
    const { noteId } = request.params as { projectId: string; noteId: string }
    await app.prisma.projectNote.delete({ where: { id: noteId } })
    return reply.code(204).send()
  })
}
