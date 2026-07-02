import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

const PreviewSchema = z.object({
  clientId: z.string().cuid(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

const GenerateSchema = PreviewSchema.extend({
  paymentDays: z.coerce.number().int().positive().default(14),
})

interface ProjectGroup {
  name: string
  minutes: number
  revenue: number
}

function groupByProject(entries: { minutes: number; revenueValue: { toString(): string }; project: { name: string } }[]) {
  const map = new Map<string, ProjectGroup>()
  for (const e of entries) {
    const name = e.project.name
    const cur = map.get(name) ?? { name, minutes: 0, revenue: 0 }
    map.set(name, {
      name,
      minutes: cur.minutes + e.minutes,
      revenue: cur.revenue + Number(e.revenueValue),
    })
  }
  return [...map.values()]
}

function fmtDate(d: Date) {
  return d.toISOString().split('T')[0]
}

export async function invoicesRoutes(app: FastifyInstance) {
  const adminAuth = { onRequest: [app.authenticate, app.adminGuard] }

  // GET /api/invoices/preview — podgląd faktury przed wystawieniem
  app.get('/preview', adminAuth, async (request, reply) => {
    const q = PreviewSchema.parse(request.query)

    const [client, entries] = await Promise.all([
      app.prisma.client.findUnique({
        where: { id: q.clientId },
        select: { name: true, hourlyRate: true, fakturowniaId: true },
      }),
      app.prisma.timeEntry.findMany({
        where: {
          project: { clientId: q.clientId },
          date: { gte: new Date(q.from), lte: new Date(q.to) },
        },
        select: { minutes: true, revenueValue: true, project: { select: { name: true } } },
      }),
    ])

    if (!client) return reply.code(404).send({ error: 'Klient nie znaleziony' })
    if (!entries.length) return reply.code(400).send({ error: 'Brak wpisów w wybranym okresie' })

    const groups = groupByProject(entries)
    const rate = Number(client.hourlyRate)
    const today = new Date()

    const positions = groups.map((g) => {
      const hours = parseFloat((g.minutes / 60).toFixed(4))
      return {
        name: g.name,
        hours,
        priceNet: rate,
        totalNet: parseFloat((hours * rate).toFixed(2)),
      }
    })

    const totalNet = parseFloat(positions.reduce((s, p) => s + p.totalNet, 0).toFixed(2))
    const vat = parseFloat((totalNet * 0.23).toFixed(2))

    return {
      client: { name: client.name, fakturowniaId: client.fakturowniaId },
      positions,
      totalNet,
      vat,
      totalGross: parseFloat((totalNet + vat).toFixed(2)),
      rate,
      issueDate: fmtDate(today),
      sellDate: q.to,
    }
  })

  // POST /api/invoices/generate — wystawia fakturę w Fakturowni
  app.post('/generate', adminAuth, async (request, reply) => {
    const body = GenerateSchema.parse(request.body)

    const config = await app.prisma.fakturowniaConfig.findUnique({ where: { id: 'fakturownia' } })
    if (!config) return reply.code(400).send({ error: 'Fakturownia nie jest skonfigurowana' })

    const [client, entries] = await Promise.all([
      app.prisma.client.findUnique({
        where: { id: body.clientId },
        select: { name: true, hourlyRate: true, fakturowniaId: true },
      }),
      app.prisma.timeEntry.findMany({
        where: {
          project: { clientId: body.clientId },
          date: { gte: new Date(body.from), lte: new Date(body.to) },
        },
        select: { minutes: true, revenueValue: true, project: { select: { name: true } } },
      }),
    ])

    if (!client) return reply.code(404).send({ error: 'Klient nie znaleziony' })
    if (!entries.length) return reply.code(400).send({ error: 'Brak wpisów w wybranym okresie' })

    const groups = groupByProject(entries)
    const rate = Number(client.hourlyRate)

    const today = new Date()
    const paymentTo = new Date(today)
    paymentTo.setDate(paymentTo.getDate() + body.paymentDays)

    const positions = groups.map((g) => ({
      name: g.name,
      quantity: parseFloat((g.minutes / 60).toFixed(4)),
      quantity_unit: 'h',
      price_net: rate.toFixed(2),
      tax: '23',
    }))

    const buyerField = client.fakturowniaId
      ? { buyer_id: parseInt(client.fakturowniaId, 10) }
      : { buyer_name: client.name }

    const payload = {
      api_token: config.apiToken,
      invoice: {
        kind: 'vat',
        number: null as null,
        sell_date: body.to,
        issue_date: fmtDate(today),
        payment_to: fmtDate(paymentTo),
        payment_type: 'transfer',
        currency: 'PLN',
        ...buyerField,
        positions_attributes: positions,
      },
    }

    let res: Response
    try {
      res = await fetch(`https://${config.domain}.fakturownia.pl/invoices.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch {
      return reply.code(502).send({ error: 'Nie można połączyć się z Fakturownią' })
    }

    if (!res.ok) {
      const text = await res.text()
      return reply.code(502).send({ error: `Fakturownia: ${text}` })
    }

    const result = (await res.json()) as { id: number; view_url: string; number: string }
    return { id: result.id, url: result.view_url, number: result.number }
  })
}
