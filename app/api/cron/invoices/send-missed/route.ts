import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { buildInvoiceEmailHtml } from '@/lib/email-templates'
import { generateInvoicePdf } from '@/lib/invoice-pdf'

const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const TYPE_LABELS: Record<string, string> = { WEB: 'Web', GOOGLE: 'Fiche Google', RESEAUX: 'Réseaux sociaux', BLOG: 'Blog' }

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n).replace(/\u202F/g, ' ')
}

// Missed invoices for March 2026 — using exact IDs from database
const MISSED_INVOICES = [
  { id: 'cmmkjrruq00045uasa74aonz0', label: 'Abdallah Fartas - WEB' },       // billingDay 20
  { id: 'cmmkjmvy30001o8cck7zeza3x', label: 'Dina Mehri - WEB' },            // billingDay 23
  { id: 'cmmkjjcdf00025uasamt62dn8', label: 'Mounir Hizour - WEB' },         // billingDay 20
  { id: 'cmmklhiad00022vrpbbe0d01f', label: 'Abdallah Fartas - GOOGLE' },     // billingDay 15
  { id: 'cmmklft0i00002vrpfgi3md73', label: 'Mounir Hizour - GOOGLE (16)' },  // billingDay 16
  { id: 'cmmkkxs3j0005o4iz0u5l2xwc', label: 'Mounir Hizour - GOOGLE (20)' },  // billingDay 20
  { id: 'cmmklt9vr0000uqasy76cnkti', label: 'Aya Achache - RESEAUX' },        // billingDay 12
  { id: 'cmmkm6spz0001mhjgjlkxeh8m', label: 'Arthur EHRET - BLOG' },          // billingDay 17
]

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // List mode: show all active maintenances to find exact names
  const { searchParams } = new URL(req.url)
  if (searchParams.get('list') === '1') {
    const all = await prisma.maintenanceContract.findMany({
      where: { active: true, priceHT: { not: null } },
      select: { id: true, clientName: true, type: true, billing: true, billingDay: true, priceHT: true, clientEmail: true },
      orderBy: { clientName: 'asc' },
    })
    return NextResponse.json({ count: all.length, maintenances: all })
  }

  const currentMonth = 3 // Mars
  const currentYear = 2026

  let gmailUser = process.env.GMAIL_KAMEO_USER
  let gmailPass = process.env.GMAIL_KAMEO_PASSWORD
  if (!gmailUser || !gmailPass) {
    gmailUser = process.env.GMAIL_BENJAMIN_USER
    gmailPass = process.env.GMAIL_BENJAMIN_PASSWORD
  }
  if (!gmailUser || !gmailPass) {
    gmailUser = process.env.GMAIL_USER
    gmailPass = process.env.GMAIL_APP_PASSWORD
  }
  if (!gmailUser || !gmailPass) {
    return NextResponse.json({ error: 'Email non configuré' }, { status: 500 })
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailUser, pass: gmailPass },
  })

  const results: Array<{ label: string; status: string; invoiceNumber?: string; error?: string }> = []

  // Find the highest existing invoice number for this month to continue from
  const lastInvoice = await prisma.maintenanceInvoice.findFirst({
    where: { year: currentYear, month: currentMonth },
    orderBy: { number: 'desc' },
    select: { number: true },
  })
  let nextNum = 1
  if (lastInvoice) {
    const match = lastInvoice.number.match(/-(\d+)$/)
    if (match) nextNum = parseInt(match[1], 10) + 1
  }

  for (const missed of MISSED_INVOICES) {
    try {
      // Find the maintenance by exact ID
      const maintenance = await prisma.maintenanceContract.findUnique({
        where: { id: missed.id },
        include: {
          invoices: {
            where: { month: currentMonth, year: currentYear },
          },
        },
      })

      if (!maintenance) {
        results.push({ label: missed.label, status: 'NOT_FOUND' })
        continue
      }

      // Skip if already invoiced this month
      if (maintenance.invoices.length > 0) {
        results.push({ label: missed.label, status: 'ALREADY_INVOICED', invoiceNumber: maintenance.invoices[0].number })
        continue
      }

      // Resolve email
      let recipientEmail = maintenance.clientEmail
      if (!recipientEmail) {
        const clientProfile = await prisma.client.findFirst({
          where: { name: { contains: maintenance.clientName.split(' ')[0], mode: 'insensitive' } },
          select: { email: true },
        })
        recipientEmail = clientProfile?.email || null
      }
      if (!recipientEmail) {
        results.push({ label: missed.label, status: 'NO_EMAIL' })
        continue
      }

      const amountHT = maintenance.priceHT!
      const amountTTC = amountHT * 1.2

      // Generate invoice number
      const invoiceNumber = `FAC-${currentYear}${String(currentMonth).padStart(2, '0')}-${String(nextNum).padStart(3, '0')}`

      // Create invoice record
      await prisma.maintenanceInvoice.create({
        data: {
          maintenanceId: maintenance.id,
          number: invoiceNumber,
          month: currentMonth,
          year: currentYear,
          amountHT,
          amountTTC,
          clientName: maintenance.clientName,
          clientEmail: recipientEmail,
          sentAt: new Date(),
        },
      })

      // Build email
      const html = buildInvoiceEmailHtml({
        clientName: maintenance.clientName,
        invoiceNumber,
        amountHT: formatCurrency(amountHT),
        amountTTC: formatCurrency(amountTTC),
        month: MONTH_NAMES[currentMonth - 1],
        year: currentYear,
        maintenanceType: maintenance.type,
      })

      // Lookup client for PDF
      const client = await prisma.client.findFirst({
        where: { name: { contains: maintenance.clientName.split(' ')[0], mode: 'insensitive' } },
        select: { company: true, address: true, postalCode: true, city: true, siret: true },
      })

      // Generate PDF
      const pdfBuffer = await generateInvoicePdf({
        invoiceNumber,
        clientName: maintenance.clientName,
        clientCompany: client?.company,
        clientAddress: client?.address,
        clientPostalCode: client?.postalCode,
        clientCity: client?.city,
        clientSiret: client?.siret,
        maintenanceType: maintenance.type,
        month: MONTH_NAMES[currentMonth - 1],
        year: currentYear,
        amountHT,
        amountTTC,
      })

      // Send email
      await transporter.sendMail({
        from: `"Agence Kameo" <${gmailUser}>`,
        to: recipientEmail,
        bcc: 'contact@agence-kameo.fr',
        subject: `Facture maintenance ${TYPE_LABELS[maintenance.type] || maintenance.type} — ${MONTH_NAMES[currentMonth - 1]} ${currentYear} — ${maintenance.clientName}`,
        html,
        attachments: [{
          filename: `${invoiceNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        }],
      })

      nextNum++
      results.push({ label: missed.label, status: 'SENT', invoiceNumber })
    } catch (err) {
      results.push({ label: missed.label, status: 'ERROR', error: (err as Error).message })
    }
  }

  return NextResponse.json({ success: true, results })
}
