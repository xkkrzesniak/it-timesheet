import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { Role } from '@prisma/client'
import type { JwtPayload } from '../plugins/auth.js'

const AzureTokenSchema = z.object({
  azureToken: z.string().min(1),
})

export async function authRoutes(app: FastifyInstance) {
  /**
   * POST /api/auth/azure
   * Frontend wysyła idToken z MSAL. Backend weryfikuje przez JWKS Microsoft,
   * upsertuje usera w bazie i zwraca własny JWT sesji.
   */
  app.post('/azure', async (request, reply) => {
    const body = AzureTokenSchema.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' })

    const { azureToken } = body.data

    try {
      const tenantId = process.env.AZURE_TENANT_ID!
      const clientId = process.env.AZURE_CLIENT_ID!

      const JWKS = createRemoteJWKSet(
        new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`)
      )

      const { payload } = await jwtVerify(azureToken, JWKS, {
        audience: clientId,
        issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
      })

      const azureOid = payload.oid as string | undefined
      if (!azureOid) {
        return reply.code(401).send({ error: 'Token missing oid claim' })
      }

      const email = ((payload['preferred_username'] ?? payload['email'] ?? '') as string)
      const name = ((payload['name'] ?? email) as string)

      const user = await app.prisma.user.upsert({
        where: { azureOid },
        update: { name, email },
        create: {
          azureOid,
          email,
          name,
          role: Role.USER,
        },
        select: { id: true, email: true, name: true, role: true, azureOid: true, isActive: true },
      })

      if (!user.isActive) {
        return reply.code(403).send({ error: 'Konto nieaktywne. Skontaktuj się z administratorem.' })
      }

      const jwtPayload: JwtPayload = {
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        azureOid: user.azureOid!,
      }

      const token = app.jwt.sign(jwtPayload, { expiresIn: '8h' })

      return reply.send({
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      })
    } catch (err) {
      app.log.error({ err }, 'Azure token verification failed')
      return reply.code(401).send({ error: 'Token verification failed' })
    }
  })

  app.get('/me', { onRequest: [app.authenticate] }, async (request) => {
    const user = await app.prisma.user.findUnique({
      where: { id: request.user.sub },
      select: { id: true, name: true, email: true, role: true, hourlyRate: true },
    })
    return user
  })

  app.post('/logout', { onRequest: [app.authenticate] }, async () => {
    return { success: true }
  })
}
