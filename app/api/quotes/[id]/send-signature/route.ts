import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import nodemailer from 'nodemailer'
import { buildSignatureEmailHtml, buildSignatureEmailText } from '@/lib/email-templates'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const { signerFirstName, signerLastName, signerEmail, signerPhone, senderEmail, tone, nameDisplay, emailSubject, testMode, scheduledAt } = body
  if (!signerFirstName?.trim() || !signerLastName?.trim() || !signerEmail?.trim()) {
    return NextResponse.json({ error: 'Prénom, nom et email sont requis.' }, { status: 400 })
  }

  // Validate email formats to prevent header injection
  const emailRegex = /^[^\s@\r\n]+@[^\s@\r\n]+\.[^\s@\r\n]+$/
  if (!emailRegex.test(signerEmail.trim())) {
    return NextResponse.json({ error: 'Email du signataire invalide.' }, { status: 400 })
  }
  if (senderEmail && !emailRegex.test(senderEmail.trim())) {
    return NextResponse.json({ error: 'Email expéditeur invalide.' }, { status: 400 })
  }

  try {
    // Fetch quote
    const quote = await prisma.quote.findUnique({
      where: { id },
      include: { items: { orderBy: { position: 'asc' } } },
    })
    if (!quote) return NextResponse.json({ error: 'Devis introuvable.' }, { status: 404 })

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex')

    // Calculate expiration: use validUntil or default 30 days
    const expiresAt = quote.validUntil
      ? new Date(quote.validUntil)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    // Ensure expiration is in the future
    if (expiresAt <= new Date()) {
      return NextResponse.json({ error: 'La date de validité du devis est dépassée.' }, { status: 400 })
    }

    // Create signature request (skip in test mode)
    if (!testMode) {
      await prisma.signatureRequest.create({
        data: {
          quoteId: id,
          token,
          signerFirstName: signerFirstName.trim(),
          signerLastName: signerLastName.trim(),
          signerEmail: signerEmail.trim(),
          signerPhone: signerPhone?.trim() || null,
          expiresAt,
          ...(scheduledAt ? { scheduledAt: new Date(scheduledAt), scheduledSent: false } : {}),
        },
      })
    }

    // If scheduled (and not test mode), don't send email now — keep EN_ATTENTE until cron sends it
    if (scheduledAt && !testMode) {
      return NextResponse.json({
        success: true,
        scheduled: true,
        scheduledAt,
        message: 'Signature planifiée',
      })
    }

    // Build signing URL — prefer VERCEL_PROJECT_PRODUCTION_URL or VERCEL_URL in production
    const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const signingUrl = `${baseUrl}/signer/${token}`

    // Send email — resolve credentials same as /api/email/send
    const gmailAccounts: Record<string, { user: string | undefined; pass: string | undefined }> = {
      benjamin: { user: process.env.GMAIL_BENJAMIN_USER, pass: process.env.GMAIL_BENJAMIN_PASSWORD },
      kameo: { user: process.env.GMAIL_KAMEO_USER, pass: process.env.GMAIL_KAMEO_PASSWORD },
      louison: { user: process.env.GMAIL_LOUISON_USER, pass: process.env.GMAIL_LOUISON_PASSWORD },
    }
    let gmailUser: string | undefined
    let gmailPass: string | undefined
    for (const key of ['benjamin', 'kameo', 'louison']) {
      if (gmailAccounts[key]?.user && gmailAccounts[key]?.pass) {
        gmailUser = gmailAccounts[key].user
        gmailPass = gmailAccounts[key].pass
        break
      }
    }
    if (!gmailUser || !gmailPass) {
      gmailUser = process.env.GMAIL_USER
      gmailPass = process.env.GMAIL_APP_PASSWORD
    }

    if (!gmailUser || !gmailPass) {
      return NextResponse.json({ error: 'Email non configuré.' }, { status: 503 })
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    })

    const expiresFormatted = expiresAt.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

    const emailParams = {
      signerFirstName: signerFirstName.trim(),
      signerLastName: signerLastName.trim(),
      quoteNumber: quote.number,
      subject: emailSubject?.trim() || quote.subject || quote.clientName || 'Devis',
      signingUrl,
      expiresAt: expiresFormatted,
      tone: (tone as 'tu' | 'vous') || 'vous',
      nameDisplay: (nameDisplay as 'prenom' | 'nom') || 'prenom',
    }

    // Use custom sender if provided, fallback to Gmail user
    const fromEmail = senderEmail?.trim() || gmailUser
    const fromName = (session.user.name || 'Agence Kameo').replace(/[\r\n]/g, '')

    await transporter.sendMail({
      from: `"${fromName} - Agence Kameo" <${gmailUser}>`,
      to: signerEmail.trim(),
      subject: `Proposition commerciale N° ${quote.number} — ${emailSubject?.trim() || quote.subject || quote.clientName}`,
      text: buildSignatureEmailText(emailParams),
      html: buildSignatureEmailHtml(emailParams),
      replyTo: fromEmail || gmailUser,
    })

    if (!testMode) {
      // Update quote status to ENVOYE
      await prisma.quote.update({
        where: { id },
        data: { status: 'ENVOYE' },
      })
    }

    return NextResponse.json({
      success: true,
      message: testMode ? 'Email de test envoyé.' : 'Le client recevra un email avec un lien pour signer le devis.',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/quotes/[id]/send-signature]', message, err)
    return NextResponse.json({ error: `Erreur lors de l'envoi: ${message}` }, { status: 500 })
  }
}
