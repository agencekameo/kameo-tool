import { auth } from '@/lib/auth'
import { rateLimit } from '@/lib/security'
import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
type GmailCreds = { user: string; pass: string; type: 'password' } | { user: string; clientId: string; clientSecret: string; refreshToken: string; type: 'oauth2' }

// Resolve Gmail credentials based on senderId
function getGmailCredentials(senderId?: string): GmailCreds | null {
  // OAuth2 accounts
  if (senderId === 'jonathan' && process.env.GMAIL_JONATHAN_USER && process.env.GMAIL_JONATHAN_CLIENT_ID) {
    return {
      user: process.env.GMAIL_JONATHAN_USER,
      clientId: process.env.GMAIL_JONATHAN_CLIENT_ID,
      clientSecret: process.env.GMAIL_JONATHAN_CLIENT_SECRET!,
      refreshToken: process.env.GMAIL_JONATHAN_REFRESH_TOKEN!,
      type: 'oauth2',
    }
  }

  // App password accounts
  const accounts: Record<string, { user: string | undefined; pass: string | undefined }> = {
    benjamin: { user: process.env.GMAIL_BENJAMIN_USER, pass: process.env.GMAIL_BENJAMIN_PASSWORD },
    kameo: { user: process.env.GMAIL_KAMEO_USER, pass: process.env.GMAIL_KAMEO_PASSWORD },
    louison: { user: process.env.GMAIL_LOUISON_USER, pass: process.env.GMAIL_LOUISON_PASSWORD },
  }

  // Try sender-specific account first
  if (senderId && accounts[senderId]?.user && accounts[senderId]?.pass) {
    return { user: accounts[senderId].user!, pass: accounts[senderId].pass!, type: 'password' }
  }

  // Fallback: try benjamin, then kameo, then generic
  for (const key of ['benjamin', 'kameo']) {
    if (accounts[key]?.user && accounts[key]?.pass) return { user: accounts[key].user!, pass: accounts[key].pass!, type: 'password' }
  }

  // Last resort: generic env vars
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  if (user && pass) return { user, pass, type: 'password' }

  return null
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Rate limit: max 10 emails per user per 5 minutes
  if (!rateLimit(`email:${session.user.id}`, 10, 5 * 60 * 1000)) {
    return NextResponse.json({ error: 'Trop d\'emails envoyés. Réessayez dans quelques minutes.' }, { status: 429 })
  }

  const { to, subject, body, replyTo, rawHtml, senderName, senderId } = await req.json()
  if (!to || !subject || (!body && !rawHtml)) {
    return NextResponse.json({ error: 'Champs manquants (to, subject, body ou rawHtml)' }, { status: 400 })
  }

  // Validate email format to prevent header injection
  const emailRegex = /^[^\s@\r\n]+@[^\s@\r\n]+\.[^\s@\r\n]+$/
  if (!emailRegex.test(to)) return NextResponse.json({ error: 'Email destinataire invalide' }, { status: 400 })
  if (replyTo && !emailRegex.test(replyTo)) return NextResponse.json({ error: 'Email replyTo invalide' }, { status: 400 })

  const creds = getGmailCredentials(senderId)
  if (!creds) {
    return NextResponse.json({ error: 'Gmail non configuré. Ajoutez les variables d\'environnement Gmail.' }, { status: 503 })
  }

  const transporter = nodemailer.createTransport(
    creds.type === 'oauth2'
      ? {
          service: 'gmail',
          auth: {
            type: 'OAuth2',
            user: creds.user,
            clientId: creds.clientId,
            clientSecret: creds.clientSecret,
            refreshToken: creds.refreshToken,
          },
        }
      : {
          service: 'gmail',
          auth: { user: creds.user, pass: creds.pass },
        }
  )

  // Escape HTML to prevent injection
  function escapeHtml(str: string) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  try {
    const htmlContent = rawHtml || escapeHtml(body).replace(/\n/g, '<br>')
    const textContent = body || 'Voir la version HTML de cet email.'
    await transporter.sendMail({
      from: `"${escapeHtml(senderName || session.user.name || 'Kameo')} — Agence Kameo" <${creds.user}>`,
      to,
      subject,
      text: textContent,
      html: htmlContent,
      replyTo: replyTo || creds.user,
    })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('[POST /api/email/send]', error)
    return NextResponse.json({ error: 'Erreur lors de l\'envoi de l\'email' }, { status: 500 })
  }
}
