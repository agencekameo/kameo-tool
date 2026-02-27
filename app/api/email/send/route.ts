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

  try {
    await transporter.sendMail({
      from: `"${session.user.name} — Agence Kameo" <${user}>`,
      to,
      subject,
      text: body,
      html: body.replace(/\n/g, '<br>'),
      replyTo: replyTo || user,
    })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
