import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import nodemailer from 'nodemailer'
import { buildContractSignatureEmailHtml } from '@/lib/email-templates'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  try {
    const contract = await prisma.contract.findUnique({ where: { id } })
    if (!contract) return NextResponse.json({ error: 'Contrat introuvable' }, { status: 404 })

    const body = await req.json()
    const { email } = body
    if (!email) return NextResponse.json({ error: 'Email requis' }, { status: 400 })

    const token = randomBytes(32).toString('hex')
    const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const signingUrl = `${baseUrl}/signature/contrat/${token}`

    await prisma.contract.update({
      where: { id },
      data: {
        signatureToken: token,
        signatureStatus: 'ENVOYE',
        sentForSignAt: new Date(),
        clientEmail: email,
      },
    })

    // Resolve Gmail credentials — same logic as /api/quotes/send-signature
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
      return NextResponse.json({ error: 'Email non configuré' }, { status: 500 })
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    })

    const senderName = (session.user as { name?: string }).name || 'Agence Kameo'
    const html = buildContractSignatureEmailHtml({
      clientName: contract.clientName,
      subject: contract.subject || 'Contrat',
      type: contract.type,
      signingUrl,
    })

    await transporter.sendMail({
      from: `"${senderName} - Agence Kameo" <${gmailUser}>`,
      to: email,
      subject: `Contrat à signer — ${contract.subject || contract.clientName}`,
      html,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[POST /api/contracts/[id]/send-signature]', err)
    return NextResponse.json({ error: 'Erreur lors de l\'envoi: ' + (err instanceof Error ? err.message : 'Erreur inconnue') }, { status: 500 })
  }
}
