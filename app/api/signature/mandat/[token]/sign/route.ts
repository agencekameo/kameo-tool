import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  try {
    const mandat = await prisma.mandat.findUnique({ where: { signatureToken: token } })
    if (!mandat) return NextResponse.json({ error: 'Mandat introuvable' }, { status: 404 })
    if (mandat.signatureStatus === 'SIGNE') return NextResponse.json({ error: 'Déjà signé' }, { status: 400 })

    const body = await req.json()
    const { signatureData, city, bic, iban } = body
    if (!signatureData) return NextResponse.json({ error: 'Signature requise' }, { status: 400 })

    const now = new Date()

    await prisma.mandat.update({
      where: { id: mandat.id },
      data: {
        signatureStatus: 'SIGNE',
        signedAt: now,
        signatureData,
        signedCity: city || null,
        signerName: mandat.clientName,
        bic: bic || null,
        iban: iban || null,
        paymentType: 'RECURRENT',
      },
    })

    // Notification email
    try {
      const gmailUser = process.env.GMAIL_USER
      const gmailPass = process.env.GMAIL_APP_PASSWORD
      if (gmailUser && gmailPass) {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: gmailUser, pass: gmailPass },
        })
        const signedDate = now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        const fmtPrice = mandat.priceHT
          ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(mandat.priceHT))
          : null
        await transporter.sendMail({
          from: `"Kameo Tool" <${gmailUser}>`,
          to: 'contact@agence-kameo.fr',
          subject: `✅ Mandat signé — ${mandat.clientName}${fmtPrice ? ` — ${fmtPrice} HT` : ''}`,
          text: `Le mandat "${mandat.subject}" a été signé.\n\nClient : ${mandat.clientName}${fmtPrice ? `\nMontant : ${fmtPrice} HT` : ''}${mandat.referenceMandat ? `\nRéf. mandat : ${mandat.referenceMandat}` : ''}\nFait à : ${city || 'N/A'}\nDate de signature : ${signedDate}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:500px;">
            <div style="height:4px;background:linear-gradient(135deg,#E14B89,#F8903C);border-radius:4px;margin-bottom:24px;"></div>
            <h2 style="color:#1a1a2e;margin:0 0 16px;">Mandat signé ✅</h2>
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:0 0 16px;">
              ${fmtPrice ? `<p style="color:#166534;font-size:24px;font-weight:700;margin:0;">${escapeHtml(fmtPrice)} HT</p>` : ''}
              <p style="color:#15803d;font-size:13px;margin:4px 0 0;">Mandat — ${escapeHtml(mandat.subject || '')}</p>
            </div>
            <p style="color:#444;margin:0 0 8px;"><strong>Client :</strong> ${escapeHtml(mandat.clientName || '')}</p>
            <p style="color:#444;margin:0 0 8px;"><strong>Objet :</strong> ${escapeHtml(mandat.subject || '')}</p>
            ${mandat.referenceMandat ? `<p style="color:#444;margin:0 0 8px;"><strong>Réf. mandat :</strong> ${escapeHtml(mandat.referenceMandat)}</p>` : ''}
            ${city ? `<p style="color:#444;margin:0 0 8px;"><strong>Fait à :</strong> ${escapeHtml(city)}</p>` : ''}
            <p style="color:#888;font-size:12px;margin:16px 0 0;">Signé le ${escapeHtml(signedDate)}</p>
          </div>`,
        })
      }
    } catch (emailErr) {
      console.error('[MANDAT SIGNATURE NOTIFICATION]', emailErr)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[POST /api/signature/mandat/[token]/sign]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
