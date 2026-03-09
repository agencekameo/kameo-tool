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

  const { signerFirstName, signerLastName, signerEmail, signerPhone, senderEmail } = body
  if (!signerFirstName?.trim() || !signerLastName?.trim() || !signerEmail?.trim()) {
    return NextResponse.json({ error: 'Prénom, nom et email sont requis.' }, { status: 400 })
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

    // Create signature request
    await prisma.signatureRequest.create({
      data: {
        quoteId: id,
        token,
        signerFirstName: signerFirstName.trim(),
        signerLastName: signerLastName.trim(),
        signerEmail: signerEmail.trim(),
        signerPhone: signerPhone?.trim() || null,
        expiresAt,
      },
    })

    // Build signing URL
    const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'
    const signingUrl = `${baseUrl}/signer/${token}`

    // Send email
    const gmailUser = process.env.GMAIL_USER
    const gmailPass = process.env.GMAIL_APP_PASSWORD

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
      subject: quote.subject,
      signingUrl,
      expiresAt: expiresFormatted,
    }

    // Use custom sender if provided, fallback to Gmail user
    const fromEmail = senderEmail?.trim() || gmailUser
    const fromName = session.user.name || 'Agence Kameo'

    await transporter.sendMail({
      from: `"${fromName} — Agence Kameo" <${fromEmail}>`,
      to: signerEmail.trim(),
      subject: `Devis N° ${quote.number} — ${quote.subject}`,
      text: buildSignatureEmailText(emailParams),
      html: buildSignatureEmailHtml(emailParams),
      replyTo: fromEmail,
    })

    // Update quote status to ENVOYE
    await prisma.quote.update({
      where: { id },
      data: { status: 'ENVOYE' },
    })

    return NextResponse.json({
      success: true,
      message: 'Le client recevra un email avec un lien pour signer le devis.',
    })
  } catch (err) {
    console.error('[POST /api/quotes/[id]/send-signature]', err)
    return NextResponse.json({ error: 'Erreur lors de l\'envoi.' }, { status: 500 })
  }
}
