import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

const FakturowniaSchema = z.object({
  domain: z.string().min(1).max(100).trim(),
  apiToken: z.string().min(1).max(500).trim(),
})

export async function settingsRoutes(app: FastifyInstance) {
  const adminAuth = { onRequest: [app.authenticate, app.adminGuard] }

  // GET /api/settings/fakturownia
  app.get('/fakturownia', adminAuth, async () => {
    const config = await app.prisma.fakturowniaConfig.findUnique({ where: { id: 'fakturownia' } })
    if (!config) return { configured: false, domain: '', hasToken: false }
    return { configured: true, domain: config.domain, hasToken: !!config.apiToken }
  })

  // PUT /api/settings/fakturownia
  app.put('/fakturownia', adminAuth, async (request, reply) => {
    const body = FakturowniaSchema.parse(request.body)
    await app.prisma.fakturowniaConfig.upsert({
      where: { id: 'fakturownia' },
      update: { domain: body.domain, apiToken: body.apiToken },
      create: { id: 'fakturownia', domain: body.domain, apiToken: body.apiToken },
    })
    return { ok: true }
  })

  // GET /api/settings/fakturownia/kontrahenci — proxy do Fakturowni, lista kontrahentów
  app.get('/fakturownia/kontrahenci', adminAuth, async (_request, reply) => {
    const config = await app.prisma.fakturowniaConfig.findUnique({ where: { id: 'fakturownia' } })
    if (!config) return reply.code(400).send({ error: 'Fakturownia nie jest skonfigurowana' })

    const url = `https://${config.domain}.fakturownia.pl/clients.json?api_token=${config.apiToken}&per_page=100`
    let res: Response
    try {
      res = await fetch(url)
    } catch (err) {
      return reply.code(502).send({ error: 'Nie można połączyć się z Fakturownią' })
    }

    if (!res.ok) {
      const text = await res.text()
      return reply.code(502).send({ error: `Fakturownia: ${text}` })
    }

    const raw = (await res.json()) as { id: number; name: string; email?: string; nip?: string }[]
    return raw.map((c) => ({ id: String(c.id), name: c.name, email: c.email ?? '', nip: c.nip ?? '' }))
  })
}
