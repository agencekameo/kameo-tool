export const runtime = 'nodejs'

import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import nodemailer from 'nodemailer'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email?.trim()) return NextResponse.json({ error: 'Email requis.' }, { status: 400 })

    const user = await prisma.user.findFirst({ where: { email: email.trim().toLowerCase() } })
    if (!user) {
      // Don't reveal if email exists or not
      return NextResponse.json({ success: true })
    }

    // Generate random password
    const newPassword = crypto.randomBytes(6).toString('base64url').slice(0, 10)
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    })

    // Send email with new password — try credential pairs in order
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
      return NextResponse.json({ error: 'Email non configuré.' }, { status: 503 })
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    })

    await transporter.sendMail({
      from: `"Kameo Tool" <${gmailUser}>`,
      to: email.trim(),
      subject: 'Votre nouveau mot de passe — Kameo Tool',
      html: `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;">
        <div style="height:4px;background:linear-gradient(135deg,#E14B89,#F8903C);border-radius:4px;margin-bottom:24px;"></div>
        <h2 style="color:#1a1a2e;margin:0 0 16px;">Nouveau mot de passe</h2>
        <p style="color:#444;margin:0 0 16px;">Bonjour ${user.name},</p>
        <p style="color:#444;margin:0 0 16px;">Votre mot de passe a été réinitialisé. Voici votre nouveau mot de passe :</p>
        <div style="background:#f8f9fa;border-radius:8px;padding:16px;text-align:center;margin:0 0 16px;">
          <code style="font-size:20px;font-weight:700;color:#E14B89;letter-spacing:2px;">${newPassword}</code>
        </div>
        <p style="color:#888;font-size:13px;">Nous vous recommandons de le changer depuis votre profil après connexion.</p>
        <p style="color:#aaa;font-size:12px;margin-top:24px;">Agence Kameo — kameo-tool.vercel.app</p>
      </div>`,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[RESET PASSWORD]', err)
    const msg = err instanceof Error ? err.message : 'Erreur serveur.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
