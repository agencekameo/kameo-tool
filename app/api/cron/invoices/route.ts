import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { buildInvoiceEmailHtml } from '@/lib/email-templates'
import { generateInvoicePdf } from '@/lib/invoice-pdf'
import { createNotificationForAdmins } from '@/lib/notifications'

const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const TYPE_LABELS: Record<string, string> = { WEB: 'Web', GOOGLE: 'Fiche Google', RESEAUX: 'Réseaux sociaux', BLOG: 'Blog' }

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n).replace(/\u202F/g, ' ')
}

export async function GET(req: NextRequest) {
  // Verify cron secret (Vercel cron or manual trigger)
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const currentMonth = now.getMonth() + 1 // 1-12
  const currentYear = now.getFullYear()
  const currentDay = now.getDate()

  // Find all active MENSUEL + ANNUEL + TRIMESTRIEL maintenances with price
  const maintenances = await prisma.maintenanceContract.findMany({
    where: {
      active: true,
      billing: { in: ['MENSUEL', 'ANNUEL', 'TRIMESTRIEL'] },
      priceHT: { not: null },
    },
    include: {
      invoices: {
        where: { month: currentMonth, year: currentYear },
      },
    },
  })

  // Try sender accounts in order: kameo, benjamin, then generic fallback
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
    return NextResponse.json({ error: 'Email non configuré', sent: 0 }, { status: 500 })
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailUser, pass: gmailPass },
  })

  let sent = 0
  const errors: string[] = []

  for (const m of maintenances) {
    // Skip if already invoiced this month
    if (m.invoices.length > 0) continue

    if (m.billing === 'ANNUEL' || m.billing === 'TRIMESTRIEL') {
      // ANNUEL/TRIMESTRIEL: send invoice on endDate only
      if (!m.endDate) continue
      const endDay = m.endDate.getDate()
      const endMonth = m.endDate.getMonth() + 1
      const endYear = m.endDate.getFullYear()
      if (currentDay !== endDay || currentMonth !== endMonth || currentYear !== endYear) continue
    } else {
      // MENSUEL: use billingDay
      if (!m.billingDay) continue

      if (currentDay !== m.billingDay) continue

      // Don't bill before contract start
      if (m.startDate) {
        const startDate = new Date(m.startDate.getFullYear(), m.startDate.getMonth(), m.startDate.getDate())
        const today = new Date(currentYear, currentMonth - 1, currentDay)
        if (today < startDate) continue
      }

      // Check end date for MENSUEL (compare dates only, ignore time)
      if (m.endDate) {
        const endDate = new Date(m.endDate.getFullYear(), m.endDate.getMonth(), m.endDate.getDate())
        const today = new Date(currentYear, currentMonth - 1, currentDay)
        if (today > endDate) continue
      }
    }

    // Resolve recipient email: maintenance clientEmail, or fallback to client profile email
    let recipientEmail = m.clientEmail
    if (!recipientEmail) {
      const clientProfile = await prisma.client.findFirst({
        where: { name: { contains: m.clientName.split(' ')[0], mode: 'insensitive' } },
        select: { email: true },
      })
      recipientEmail = clientProfile?.email || null
    }
    if (!recipientEmail) continue // No email available, skip

    const amountHT = m.priceHT!
    const amountTTC = amountHT * 1.2

    // Generate invoice number: FAC-YYYYMM-XXX
    const invoiceCount = await prisma.maintenanceInvoice.count({
      where: { year: currentYear, month: currentMonth },
    })
    const invoiceNumber = `FAC-${currentYear}${String(currentMonth).padStart(2, '0')}-${String(invoiceCount + sent + 1).padStart(3, '0')}`

    try {
      // Create invoice record
      await prisma.maintenanceInvoice.create({
        data: {
          maintenanceId: m.id,
          number: invoiceNumber,
          month: currentMonth,
          year: currentYear,
          amountHT,
          amountTTC,
          clientName: m.clientName,
          clientEmail: recipientEmail,
          sentAt: new Date(),
        },
      })

      // Send email
      const html = buildInvoiceEmailHtml({
        clientName: m.clientName,
        invoiceNumber,
        amountHT: formatCurrency(amountHT),
        amountTTC: formatCurrency(amountTTC),
        month: MONTH_NAMES[currentMonth - 1],
        year: currentYear,
        maintenanceType: m.type,
      })

      // Lookup client info for PDF (company, address, siret)
      const client = await prisma.client.findFirst({
        where: { name: { contains: m.clientName.split(' ')[0], mode: 'insensitive' } },
        select: { company: true, address: true, postalCode: true, city: true, siret: true },
      })

      // Generate PDF invoice
      const pdfBuffer = await generateInvoicePdf({
        invoiceNumber,
        clientName: m.clientName,
        clientCompany: client?.company,
        clientAddress: client?.address,
        clientPostalCode: client?.postalCode,
        clientCity: client?.city,
        clientSiret: client?.siret,
        maintenanceType: m.type,
        month: MONTH_NAMES[currentMonth - 1],
        year: currentYear,
        amountHT,
        amountTTC,
      })

      await transporter.sendMail({
        from: `"Agence Kameo" <${gmailUser}>`,
        to: recipientEmail,
        bcc: 'contact@agence-kameo.fr',
        subject: `Facture maintenance ${TYPE_LABELS[m.type] || m.type} — ${MONTH_NAMES[currentMonth - 1]} ${currentYear} — ${m.clientName}`,
        html,
        attachments: [{
          filename: `${invoiceNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        }],
      })

      sent++
    } catch (err) {
      console.error(`[CRON INVOICE] Error for ${m.clientName}:`, err)
      errors.push(`${m.clientName}: ${(err as Error).message}`)
    }
  }

  // ─── Alertes fin de contrat (MANUEL, ANNUEL, TRIMESTRIEL) ───
  const dueMaintances = await prisma.maintenanceContract.findMany({
    where: {
      active: true,
      manualPaid: false,
      billing: { in: ['MANUEL', 'ANNUEL', 'TRIMESTRIEL'] },
      endDate: { not: null },
    },
    select: { id: true, clientName: true, type: true, billing: true, priceHT: true, endDate: true },
  })

  const BILLING_FR: Record<string, string> = { MANUEL: 'manuel', ANNUEL: 'annuel', TRIMESTRIEL: 'trimestriel' }
  let alerts = 0
  for (const m of dueMaintances) {
    const endDay = m.endDate!.getDate()
    const endMonth = m.endDate!.getMonth() + 1
    const endYear = m.endDate!.getFullYear()
    if (endDay === currentDay && endMonth === currentMonth && endYear === currentYear) {
      await createNotificationForAdmins({
        type: 'MAINTENANCE_DUE',
        title: `Échéance maintenance ${m.clientName}`,
        message: `Le contrat ${BILLING_FR[m.billing] || m.billing} ${TYPE_LABELS[m.type] || m.type} de ${m.clientName} arrive à échéance aujourd'hui (${m.priceHT ? formatCurrency(m.priceHT) + ' HT' : ''}).`,
        link: '/maintenances',
      })
      alerts++
    }
  }

  return NextResponse.json({
    success: true,
    date: now.toISOString(),
    sent,
    alerts,
    errors: errors.length > 0 ? errors : undefined,
  })
}
