import PDFDocument from 'pdfkit'
import type { JwtPayload } from '../plugins/auth.js'

type Entry = {
  date: Date
  minutes: number
  description: string | null
  snapshotUserRate: unknown
  costValue: unknown
  snapshotClientRate?: unknown
  revenueValue?: unknown
  user: { name: string }
  project: { name: string; client: { name: string } }
}

export async function generatePdf(
  entries: Entry[],
  caller: JwtPayload,
  from: string,
  to: string,
  isAdmin: boolean,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' })
    const chunks: Buffer[] = []

    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const ORANGE = '#F47C20'
    const BG = '#1A1A1A'
    const WHITE = '#FFFFFF'

    // Header
    doc.rect(0, 0, doc.page.width, 60).fill(BG)
    doc.fillColor(ORANGE).fontSize(20).font('Helvetica-Bold')
      .text('IT Timesheet', 40, 18)
    doc.fillColor(WHITE).fontSize(10).font('Helvetica')
      .text(`Raport: ${from} — ${to}`, 40, 44)
    doc.moveDown(3)

    // Kolumny
    const adminCols = ['Data', 'Użytkownik', 'Klient', 'Projekt', 'Opis', 'h', 'Stawka wł.', 'Koszt', 'Stawka kl.', 'Przychód', 'Marża']
    const userCols = ['Data', 'Klient', 'Projekt', 'Opis', 'h', 'Stawka', 'Wartość']
    const cols = isAdmin ? adminCols : userCols

    const colWidths = isAdmin
      ? [55, 80, 80, 80, 130, 30, 55, 55, 55, 55, 55]
      : [60, 100, 110, 180, 40, 55, 60]

    const startX = 40
    let y = 75

    // Nagłówki tabeli
    doc.fillColor(ORANGE).fontSize(8).font('Helvetica-Bold')
    let x = startX
    cols.forEach((col, i) => {
      doc.text(col, x, y, { width: colWidths[i], align: 'left' })
      x += colWidths[i]
    })

    doc.moveTo(startX, y + 12).lineTo(doc.page.width - 40, y + 12).stroke(ORANGE)
    y += 16

    // Wiersze
    doc.fillColor('#333333').fontSize(7).font('Helvetica')
    let totalMinutes = 0, totalCost = 0, totalRevenue = 0

    for (const e of entries) {
      if (y > doc.page.height - 80) {
        doc.addPage()
        y = 40
      }

      const hours = parseFloat((e.minutes / 60).toFixed(2))
      totalMinutes += e.minutes
      totalCost += Number(e.costValue)
      if (isAdmin) totalRevenue += Number((e as any).revenueValue ?? 0)

      const row = isAdmin
        ? [
            fmtDate(e.date), e.user.name, e.project.client.name, e.project.name,
            e.description ?? '', String(hours),
            `${Number(e.snapshotUserRate)} zł`, `${Number(e.costValue).toFixed(2)} zł`,
            `${Number((e as any).snapshotClientRate)} zł`, `${Number((e as any).revenueValue).toFixed(2)} zł`,
            `${(Number((e as any).revenueValue) - Number(e.costValue)).toFixed(2)} zł`,
          ]
        : [
            fmtDate(e.date), e.project.client.name, e.project.name,
            e.description ?? '', String(hours),
            `${Number(e.snapshotUserRate)} zł`, `${Number(e.costValue).toFixed(2)} zł`,
          ]

      x = startX
      row.forEach((cell, i) => {
        doc.fillColor('#111111').text(cell, x, y, { width: colWidths[i], align: 'left', ellipsis: true })
        x += colWidths[i]
      })

      y += 14
    }

    // Podsumowanie
    doc.moveTo(startX, y + 4).lineTo(doc.page.width - 40, y + 4).stroke(ORANGE)
    y += 10
    doc.fillColor(BG).fontSize(9).font('Helvetica-Bold')
    doc.text(`Razem: ${parseFloat((totalMinutes / 60).toFixed(2))} h | Koszt: ${totalCost.toFixed(2)} zł${isAdmin ? ` | Przychód: ${totalRevenue.toFixed(2)} zł | Marża: ${(totalRevenue - totalCost).toFixed(2)} zł` : ''}`, startX, y)

    doc.end()
  })
}

function fmtDate(d: Date) {
  return d.toISOString().split('T')[0]
}
