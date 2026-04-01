import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { buildInvoiceEmailHtml } from '@/lib/email-templates'

const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const TYPE_LABELS: Record<string, string> = { WEB: 'Web', GOOGLE: 'Fiche Google', RESEAUX: 'Réseaux sociaux', BLOG: 'Blog' }

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n).replace(/\u202F/g, ' ')
}

export async function GET() {
  try {
    // Pick first active maintenance with a price (prefer "test" client)
    const maintenances = await prisma.maintenanceContract.findMany({
      where: { active: true, priceHT: { not: null } },
      take: 50,
    })
    const maintenance = maintenances.find(m => m.clientName.toLowerCase().includes('test')) || maintenances[0] || null

    if (!maintenance) {
      return NextResponse.json({ error: 'Aucune maintenance trouvée' }, { status: 404 })
    }

    const gmailUser = process.env.GMAIL_USER
    const gmailPass = process.env.GMAIL_APP_PASSWORD
    if (!gmailUser || !gmailPass) {
      return NextResponse.json({ error: 'Email non configuré' }, { status: 500 })
    }

    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()
    const amountHT = maintenance.priceHT!
    const amountTTC = amountHT * 1.2
    const invoiceNumber = `FAC-TEST-${currentYear}${String(currentMonth).padStart(2, '0')}-001`
    const typeLabel = TYPE_LABELS[maintenance.type] || maintenance.type

    const html = buildInvoiceEmailHtml({
      clientName: maintenance.clientName,
      invoiceNumber,
      amountHT: formatCurrency(amountHT),
      amountTTC: formatCurrency(amountTTC),
      month: MONTH_NAMES[currentMonth - 1],
      year: currentYear,
      maintenanceType: maintenance.type,
    })

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    })

    await transporter.sendMail({
      from: `"Agence Kameo" <${gmailUser}>`,
      to: 'contact@agence-kameo.fr',
      subject: `[TEST] Facture maintenance ${typeLabel} — ${MONTH_NAMES[currentMonth - 1]} ${currentYear} — ${maintenance.clientName}`,
      html,
    })

    return NextResponse.json({
      success: true,
      sentTo: 'contact@agence-kameo.fr',
      client: maintenance.clientName,
      type: typeLabel,
      amountHT: formatCurrency(amountHT),
      amountTTC: formatCurrency(amountTTC),
    })
  } catch (err) {
    console.error('[TEST INVOICE]', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
