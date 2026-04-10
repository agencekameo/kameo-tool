import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { buildSignatureEmailHtml, buildSignatureEmailText } from '@/lib/email-templates'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Find pending scheduled signatures
  const pending = await prisma.signatureRequest.findMany({
    where: { scheduledAt: { lte: new Date() }, scheduledSent: false },
    include: { quote: { include: { items: { orderBy: { position: 'asc' } } } } },
  })

  if (pending.length === 0) return NextResponse.json({ sent: 0 })

  let gmailUser = process.env.GMAIL_KAMEO_USER || process.env.GMAIL_USER
  let gmailPass = process.env.GMAIL_KAMEO_PASSWORD || process.env.GMAIL_APP_PASSWORD
  if (!gmailUser || !gmailPass) return NextResponse.json({ error: 'Email non configuré' }, { status: 500 })

  const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: gmailUser, pass: gmailPass } })

  let sent = 0
  for (const sig of pending) {
    try {
      const quote = sig.quote
      const baseUrl = process.env.NEXTAUTH_URL || 'https://kameo-tool.vercel.app'
      const signingUrl = `${baseUrl}/signer/${sig.token}`
      const expiresFormatted = sig.expiresAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

      const emailParams = {
        signerFirstName: sig.signerFirstName,
        signerLastName: sig.signerLastName,
        quoteNumber: quote.number,
        subject: quote.subject || quote.clientName || 'Devis',
        signingUrl,
        expiresAt: expiresFormatted,
        tone: 'vous' as const,
        nameDisplay: 'nom' as const,
      }

      await transporter.sendMail({
        from: `"Agence Kameo" <${gmailUser}>`,
        to: sig.signerEmail,
        subject: `Proposition commerciale N° ${quote.number} — ${quote.subject || quote.clientName}`,
        text: buildSignatureEmailText(emailParams),
        html: buildSignatureEmailHtml(emailParams),
      })

      await prisma.signatureRequest.update({ where: { id: sig.id }, data: { scheduledSent: true } })
      // Set quote status to ENVOYE now that the email is actually sent
      await prisma.quote.update({ where: { id: quote.id }, data: { status: 'ENVOYE' } })
      sent++
    } catch (err) {
      console.error(`[scheduled-signatures] Error sending ${sig.id}:`, err)
    }
  }

  return NextResponse.json({ sent, total: pending.length })
}
