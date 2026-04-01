import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const contract = await prisma.contract.findUnique({ where: { signatureToken: token } })
  if (!contract) return NextResponse.json({ error: 'Contrat introuvable' }, { status: 404 })
  if (contract.signatureStatus === 'SIGNE') return NextResponse.json({ error: 'Déjà signé' }, { status: 400 })

  const body = await req.json()
  const { signatureData, city, date } = body
  if (!signatureData) return NextResponse.json({ error: 'Signature requise' }, { status: 400 })

  const now = new Date()

  await prisma.contract.update({
    where: { id: contract.id },
    data: {
      signatureStatus: 'SIGNE',
      signedAt: now,
      signatureData,
      signedCity: city || null,
      signerName: contract.clientName,
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
      const fmtPrice = contract.priceHT
        ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(contract.priceHT))
        : null
      await transporter.sendMail({
        from: `"Kameo Tool" <${gmailUser}>`,
        to: 'contact@agence-kameo.fr',
        subject: `✅ Contrat signé — ${contract.clientName}${fmtPrice ? ` — ${fmtPrice} HT` : ''}`,
        text: `Le contrat "${contract.subject}" a été signé.\n\nClient : ${contract.clientName}${fmtPrice ? `\nMontant : ${fmtPrice} HT` : ''}\nFait à : ${city || 'N/A'}\nDate de signature : ${signedDate}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:500px;">
          <div style="height:4px;background:linear-gradient(135deg,#E14B89,#F8903C);border-radius:4px;margin-bottom:24px;"></div>
          <h2 style="color:#1a1a2e;margin:0 0 16px;">Contrat signé ✅</h2>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:0 0 16px;">
            ${fmtPrice ? `<p style="color:#166534;font-size:24px;font-weight:700;margin:0;">${escapeHtml(fmtPrice)} HT</p>` : ''}
            <p style="color:#15803d;font-size:13px;margin:4px 0 0;">Contrat — ${escapeHtml(contract.subject || '')}</p>
          </div>
          <p style="color:#444;margin:0 0 8px;"><strong>Client :</strong> ${escapeHtml(contract.clientName || '')}</p>
          <p style="color:#444;margin:0 0 8px;"><strong>Objet :</strong> ${escapeHtml(contract.subject || '')}</p>
          ${city ? `<p style="color:#444;margin:0 0 8px;"><strong>Fait à :</strong> ${escapeHtml(city)}</p>` : ''}
          <p style="color:#888;font-size:12px;margin:16px 0 0;">Signé le ${escapeHtml(signedDate)}</p>
        </div>`,
      })
    }
  } catch (emailErr) {
    console.error('[CONTRAT SIGNATURE NOTIFICATION]', emailErr)
  }

  return NextResponse.json({ success: true })
}
