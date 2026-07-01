import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { prismaPlugin } from './plugins/prisma.js'
import { authPlugin } from './plugins/auth.js'
import { authRoutes } from './routes/auth.js'
import { timeEntriesRoutes } from './routes/timeEntries.js'
import { reportsRoutes } from './routes/reports.js'
import { adminRoutes } from './routes/admin.js'
import { clientsRoutes } from './routes/clients.js'
import { projectsRoutes } from './routes/projects.js'
import { dashboardRoutes } from './routes/dashboard.js'
import { tagsRoutes } from './routes/tags.js'
import { projectNotesRoutes } from './routes/projectNotes.js'

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  },
})

await app.register(cors, {
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  credentials: true,
})

await app.register(jwt, {
  secret: process.env.JWT_SECRET!,
})

await app.register(prismaPlugin)
await app.register(authPlugin)

// Routes
await app.register(authRoutes, { prefix: '/api/auth' })
await app.register(timeEntriesRoutes, { prefix: '/api/time-entries' })
await app.register(reportsRoutes, { prefix: '/api/reports' })
await app.register(clientsRoutes, { prefix: '/api/clients' })
await app.register(projectsRoutes, { prefix: '/api/projects' })
await app.register(adminRoutes, { prefix: '/api/admin' })
await app.register(dashboardRoutes, { prefix: '/api/dashboard' })
await app.register(tagsRoutes, { prefix: '/api/tags' })
await app.register(projectNotesRoutes, { prefix: '/api/projects' })

app.get('/api/health', async () => ({ status: 'ok', ts: new Date().toISOString() }))

const port = Number(process.env.PORT ?? 3001)
const host = process.env.HOST ?? '0.0.0.0'

try {
  await app.listen({ port, host })
  console.log(`🚀 Server running at http://${host}:${port}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
