import { PrismaClient, Role } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  const admin = await prisma.user.upsert({
    where: { email: 'admin@lemonpro.com' },
    update: {},
    create: {
      email: 'admin@lemonpro.com',
      name: 'Administrator',
      role: Role.ADMIN,
      hourlyRate: 150,
    },
  })

  const user1 = await prisma.user.upsert({
    where: { email: 'jan.kowalski@lemonpro.com' },
    update: {},
    create: {
      email: 'jan.kowalski@lemonpro.com',
      name: 'Jan Kowalski',
      role: Role.USER,
      hourlyRate: 120,
    },
  })

  const user2 = await prisma.user.upsert({
    where: { email: 'anna.nowak@lemonpro.com' },
    update: {},
    create: {
      email: 'anna.nowak@lemonpro.com',
      name: 'Anna Nowak',
      role: Role.USER,
      hourlyRate: 100,
    },
  })

  const clientA = await prisma.client.upsert({
    where: { id: 'client-seed-1' },
    update: {},
    create: {
      id: 'client-seed-1',
      name: 'Acme Corp',
      hourlyRate: 250, // stawka sprzedażowa — ADMIN only
    },
  })

  const clientB = await prisma.client.upsert({
    where: { id: 'client-seed-2' },
    update: {},
    create: {
      id: 'client-seed-2',
      name: 'TechStart Sp. z o.o.',
      hourlyRate: 200,
    },
  })

  const projectA1 = await prisma.project.upsert({
    where: { id: 'project-seed-1' },
    update: {},
    create: {
      id: 'project-seed-1',
      name: 'Portal klienta v2',
      clientId: clientA.id,
    },
  })

  const projectB1 = await prisma.project.upsert({
    where: { id: 'project-seed-2' },
    update: {},
    create: {
      id: 'project-seed-2',
      name: 'Integracja ERP',
      clientId: clientB.id,
    },
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  await prisma.timeEntry.createMany({
    skipDuplicates: true,
    data: [
      {
        userId: user1.id,
        projectId: projectA1.id,
        date: today,
        minutes: 120,
        description: 'Implementacja modułu autoryzacji',
        snapshotUserRate: user1.hourlyRate,
        snapshotClientRate: clientA.hourlyRate,
        costValue: (120 / 60) * Number(user1.hourlyRate),
        revenueValue: (120 / 60) * Number(clientA.hourlyRate),
      },
      {
        userId: user2.id,
        projectId: projectB1.id,
        date: today,
        minutes: 90,
        description: 'Analiza wymagań ERP',
        snapshotUserRate: user2.hourlyRate,
        snapshotClientRate: clientB.hourlyRate,
        costValue: (90 / 60) * Number(user2.hourlyRate),
        revenueValue: (90 / 60) * Number(clientB.hourlyRate),
      },
    ],
  })

  console.log('✅ Seed complete')
  console.log(`   Users: admin, jan.kowalski, anna.nowak`)
  console.log(`   Clients: ${clientA.name}, ${clientB.name}`)
  console.log(`   Projects: ${projectA1.name}, ${projectB1.name}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
