import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { Role } from '@prisma/client'

export type JwtPayload = {
  sub: string       // userId (cuid z bazy)
  email: string
  name: string
  role: Role
  azureOid: string
}

declare module 'fastify' {
  interface FastifyRequest {
    user: JwtPayload
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload
    user: JwtPayload
  }
}

export const authPlugin = fp(async (app: FastifyInstance) => {
  // Weryfikacja tokena JWT na każdym żądaniu (jeśli nagłówek Authorization present)
  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify()
    } catch {
      reply.code(401).send({ error: 'Unauthorized' })
    }
  })

  // Middleware admin-only — wywołaj po authenticate
  app.decorate('adminGuard', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.user?.role !== Role.ADMIN) {
      reply.code(403).send({ error: 'Forbidden: admin access required' })
    }
  })
})

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
    adminGuard: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}
