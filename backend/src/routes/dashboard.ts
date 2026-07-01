import type { FastifyInstance } from 'fastify'

function startOfWeekDate(d: Date) {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.getFullYear(), d.getMonth(), diff)
}

export async function dashboardRoutes(app: FastifyInstance) {
  const opts = { onRequest: [app.authenticate] }

  app.get('/', opts, async (request) => {
    const caller = request.user
    const userFilter = caller.role === 'ADMIN' ? {} : { userId: caller.sub }

    const now = new Date()
    const thisWeekStart = startOfWeekDate(now)
    const lastWeekStart = new Date(thisWeekStart)
    lastWeekStart.setDate(lastWeekStart.getDate() - 7)
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

    const [thisWeekAgg, lastWeekAgg, thisMonthAgg, lastMonthAgg, monthEntries] =
      await Promise.all([
        app.prisma.timeEntry.aggregate({
          where: { ...userFilter, date: { gte: thisWeekStart } },
          _sum: { minutes: true, costValue: true },
        }),
        app.prisma.timeEntry.aggregate({
          where: { ...userFilter, date: { gte: lastWeekStart, lt: thisWeekStart } },
          _sum: { minutes: true, costValue: true },
        }),
        app.prisma.timeEntry.aggregate({
          where: { ...userFilter, date: { gte: thisMonthStart } },
          _sum: { minutes: true, costValue: true },
        }),
        app.prisma.timeEntry.aggregate({
          where: { ...userFilter, date: { gte: lastMonthStart, lte: lastMonthEnd } },
          _sum: { minutes: true, costValue: true },
        }),
        app.prisma.timeEntry.findMany({
          where: { ...userFilter, date: { gte: thisMonthStart } },
          select: {
            minutes: true,
            costValue: true,
            project: {
              select: {
                id: true,
                name: true,
                client: { select: { name: true } },
              },
            },
          },
        }),
      ])

    // Group by client
    const clientMap = new Map<string, { hours: number; cost: number }>()
    const projectMap = new Map<string, { name: string; clientName: string; hours: number }>()

    for (const e of monthEntries) {
      const cName = e.project.client.name
      const cc = clientMap.get(cName) ?? { hours: 0, cost: 0 }
      clientMap.set(cName, {
        hours: cc.hours + e.minutes / 60,
        cost: cc.cost + Number(e.costValue),
      })

      const pId = e.project.id
      const pc = projectMap.get(pId) ?? { name: e.project.name, clientName: cName, hours: 0 }
      projectMap.set(pId, { ...pc, hours: pc.hours + e.minutes / 60 })
    }

    const topClients = [...clientMap.entries()]
      .sort((a, b) => b[1].hours - a[1].hours)
      .slice(0, 6)
      .map(([name, { hours, cost }]) => ({
        name,
        hours: parseFloat(hours.toFixed(2)),
        cost: parseFloat(cost.toFixed(2)),
      }))

    const topProjects = [...projectMap.entries()]
      .sort((a, b) => b[1].hours - a[1].hours)
      .slice(0, 5)
      .map(([, { name, clientName, hours }]) => ({
        name,
        clientName,
        hours: parseFloat(hours.toFixed(2)),
      }))

    return {
      thisWeek: {
        hours: parseFloat(((thisWeekAgg._sum.minutes ?? 0) / 60).toFixed(2)),
        cost: parseFloat(Number(thisWeekAgg._sum.costValue ?? 0).toFixed(2)),
      },
      lastWeek: {
        hours: parseFloat(((lastWeekAgg._sum.minutes ?? 0) / 60).toFixed(2)),
        cost: parseFloat(Number(lastWeekAgg._sum.costValue ?? 0).toFixed(2)),
      },
      thisMonth: {
        hours: parseFloat(((thisMonthAgg._sum.minutes ?? 0) / 60).toFixed(2)),
        cost: parseFloat(Number(thisMonthAgg._sum.costValue ?? 0).toFixed(2)),
      },
      lastMonth: {
        hours: parseFloat(((lastMonthAgg._sum.minutes ?? 0) / 60).toFixed(2)),
        cost: parseFloat(Number(lastMonthAgg._sum.costValue ?? 0).toFixed(2)),
      },
      topClients,
      topProjects,
    }
  })
}
