import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import * as jwt from 'jsonwebtoken'
import jwksClient from 'jwks-rsa'
import { Role } from '@prisma/client'
import type { JwtPayload } from '../plugins/auth.js'

// Klient JWKS do weryfikacji tokenów Microsoft Entra ID
function getJwksClient() {
  const tenantId = process.env.AZURE_TENANT_ID!
  return jwksClient({
    jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
    cache: true,
    rateLimit: true,
  })
}

function getSigningKey(client: ReturnType<typeof jwksClient>, kid: string): Promise<string> {
  return new Promise((resolve, reject) => {
    client.getSigningKey(kid, (err, key) => {
      if (err) return reject(err)
      resolve(key!.getPublicKey())
    })
  })
}

const AzureTokenSchema = z.object({
  azureToken: z.string().min(1),
})

export async function authRoutes(app: FastifyInstance) {
  /**
   * POST /api/auth/azure
   * Frontend wysyła token z MSAL (Microsoft Authentication Library).
   * Backend weryfikuje go z Entra ID, upsertuje usera, zwraca własny JWT.
   */
  app.post('/azure', async (request, reply) => {
    const body = AzureTokenSchema.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: 'Invalid body' })

    const { azureToken } = body.data

    try {
      // Dekoduj nagłówek bez weryfikacji — potrzebujemy kid
      const decoded = jwt.decode(azureToken, { complete: true })
      if (!decoded || typeof decoded === 'string') {
        return reply.code(401).send({ error: 'Invalid token format' })
      }

      const kid = decoded.header.kid
      if (!kid) {
        return reply.code(401).send({ error: 'Invalid token: missing kid' })
      }
      const client = getJwksClient()
      const publicKey = await getSigningKey(client, kid)

      const payload = jwt.verify(azureToken, publicKey, {
        audience: process.env.AZURE_CLIENT_ID,
        issuer: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/v2.0`,
      }) as jwt.JwtPayload

      const azureOid = payload.oid as string
      const email = (payload.preferred_username ?? payload.email ?? '') as string
      const name = (payload.name ?? email) as string

      // Upsert — przy pierwszym logowaniu tworzy konto
      const user = await app.prisma.user.upsert({
        where: { azureOid },
        update: { name, email },
        create: {
          azureOid,
          email,
          name,
          role: Role.USER, // domyślna rola; ADMIN nadawany ręcznie w DB
        },
        select: { id: true, email: true, name: true, role: true, azureOid: true },
      })

      const jwtPayload: JwtPayload = {
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        azureOid: user.azureOid!,
      }

      const token = app.jwt.sign(jwtPayload, { expiresIn: '8h' })

      return reply.send({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } })
    } catch (err) {
      app.log.error(err, 'Azure token verification failed')
      return reply.code(401).send({ error: 'Token verification failed' })
    }
  })

  /**
   * GET /api/auth/me — zwraca profil zalogowanego usera
   */
  app.get('/me', { onRequest: [app.authenticate] }, async (request) => {
    const user = await app.prisma.user.findUnique({
      where: { id: request.user.sub },
      select: { id: true, name: true, email: true, role: true, hourlyRate: true },
    })
    return user
  })

  /**
   * POST /api/auth/logout — bezstanowe JWT; wystarczy usunąć token po stronie klienta
   */
  app.post('/logout', { onRequest: [app.authenticate] }, async () => {
    return { success: true }
  })
}
