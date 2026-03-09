import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { to, subject, body, replyTo } = await req.json()
  if (!to || !subject || !body) {
    return NextResponse.json({ error: 'Champs manquants (to, subject, body)' }, { status: 400 })
  }

  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD

  if (!user || !pass) {
    return NextResponse.json({ error: 'Gmail non configuré. Ajoutez GMAIL_USER et GMAIL_APP_PASSWORD dans les variables d\'environnement Vercel.' }, { status: 503 })
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  })

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
    const safeHtml = escapeHtml(body).replace(/\n/g, '<br>')
    await transporter.sendMail({
      from: `"${escapeHtml(session.user.name || 'Kameo')} — Agence Kameo" <${user}>`,
      to,
      subject,
      text: body,
      html: safeHtml,
      replyTo: replyTo || user,
    })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('[POST /api/email/send]', error)
    return NextResponse.json({ error: 'Erreur lors de l\'envoi de l\'email' }, { status: 500 })
  }
}
