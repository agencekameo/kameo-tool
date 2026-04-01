import { prisma } from '@/lib/db'
import { rateLimit, csrfCheck } from '@/lib/security'
import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/**
 * Public endpoint — no auth required.
 * Submits the client's signature.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  // CSRF protection
  if (!csrfCheck(req)) {
    return NextResponse.json({ error: 'Requête non autorisée.' }, { status: 403 })
  }

  // Rate limit: max 5 signature attempts per token per 15 minutes
  if (!rateLimit(`sign:${token}`, 5, 15 * 60 * 1000)) {
    return NextResponse.json({ error: 'Trop de tentatives. Réessayez plus tard.' }, { status: 429 })
  }

  try {
    const body = await req.json()
    const { signatureData, city, date } = body

    // Validate inputs
    if (!signatureData || !city?.trim() || !date?.trim()) {
      return NextResponse.json({ error: 'Veuillez remplir tous les champs et signer.' }, { status: 400 })
    }

    // Validate signature format
    if (!signatureData.startsWith('data:image/png;base64,')) {
      return NextResponse.json({ error: 'Format de signature invalide.' }, { status: 400 })
    }

    // Validate signature size (max 500KB)
    if (signatureData.length > 500000) {
      return NextResponse.json({ error: 'Signature trop volumineuse.' }, { status: 400 })
    }

    // Validate text lengths
    if (city.trim().length > 255 || date.trim().length > 255) {
      return NextResponse.json({ error: 'Champ trop long.' }, { status: 400 })
    }

    // Find signature request
    const sigRequest = await prisma.signatureRequest.findUnique({
      where: { token },
      include: { quote: { include: { items: true } } },
    })

    if (!sigRequest) {
      return NextResponse.json({ error: 'Lien de signature introuvable.' }, { status: 404 })
    }

    if (sigRequest.usedAt) {
      return NextResponse.json({ error: 'Ce devis a déjà été signé.' }, { status: 410 })
    }

    if (new Date() > sigRequest.expiresAt) {
      return NextResponse.json({ error: 'Ce lien de signature a expiré.' }, { status: 410 })
    }

    if (sigRequest.quote.status === 'ACCEPTE') {
      return NextResponse.json({ error: 'Ce devis a déjà été accepté.' }, { status: 410 })
    }

    // Get client IP for audit
    const signerIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown'

    const now = new Date()

    // Atomic transaction: update signature request + quote status
    await prisma.$transaction([
      prisma.signatureRequest.update({
        where: { id: sigRequest.id },
        data: {
          signedAt: now,
          signatureData,
          signedCity: city.trim(),
          signedDate: date.trim(),
          signerIp,
          usedAt: now,
        },
      }),
      prisma.quote.update({
        where: { id: sigRequest.quoteId },
        data: { status: 'ACCEPTE' },
      }),
    ])

    // Send notification email to Kameo
    try {
      const gmailUser = process.env.GMAIL_USER
      const gmailPass = process.env.GMAIL_APP_PASSWORD
      if (gmailUser && gmailPass) {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: gmailUser, pass: gmailPass },
        })
        const signedDate = now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        const totalHT = sigRequest.quote.items.reduce((s, item) => s + item.quantity * item.unitPrice, 0)
        const discount = sigRequest.quote.discount || 0
        const totalAfterDiscount = totalHT - (totalHT * discount / 100)
        const fmtPrice = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(totalAfterDiscount)
        await transporter.sendMail({
          from: `"Kameo Tool" <${gmailUser}>`,
          to: 'contact@agence-kameo.fr',
          subject: `✅ Devis ${sigRequest.quote.number} signé — ${fmtPrice} HT`,
          text: `Le devis ${sigRequest.quote.number} — ${sigRequest.quote.subject} a été signé.\n\nMontant : ${fmtPrice} HT\nClient : ${sigRequest.quote.clientName}\nSignataire : ${sigRequest.signerFirstName} ${sigRequest.signerLastName} (${sigRequest.signerEmail})\nFait à : ${city.trim()}\nLe : ${date.trim()}\nDate de signature : ${signedDate}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:500px;">
            <div style="height:4px;background:linear-gradient(135deg,#E14B89,#F8903C);border-radius:4px;margin-bottom:24px;"></div>
            <h2 style="color:#1a1a2e;margin:0 0 16px;">Devis signé ✅</h2>
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:0 0 16px;">
              <p style="color:#166534;font-size:24px;font-weight:700;margin:0;">${escapeHtml(fmtPrice)} HT</p>
              <p style="color:#15803d;font-size:13px;margin:4px 0 0;">Devis ${escapeHtml(sigRequest.quote.number)}${discount > 0 ? ` (remise ${discount}%)` : ''}</p>
            </div>
            <p style="color:#444;margin:0 0 8px;"><strong>Client :</strong> ${escapeHtml(sigRequest.quote.clientName)}</p>
            <p style="color:#444;margin:0 0 8px;"><strong>Objet :</strong> ${escapeHtml(sigRequest.quote.subject)}</p>
            <p style="color:#444;margin:0 0 8px;"><strong>Signataire :</strong> ${escapeHtml(sigRequest.signerFirstName)} ${escapeHtml(sigRequest.signerLastName)}</p>
            <p style="color:#444;margin:0 0 8px;"><strong>Email :</strong> ${escapeHtml(sigRequest.signerEmail)}</p>
            <p style="color:#444;margin:0 0 8px;"><strong>Fait à :</strong> ${escapeHtml(city.trim())} — Le : ${escapeHtml(date.trim())}</p>
            <p style="color:#888;font-size:12px;margin:16px 0 0;">Signé le ${escapeHtml(signedDate)}</p>
          </div>`,
        })
      }
    } catch (emailErr) {
      // Don't fail the signature if notification email fails
      console.error('[SIGNATURE NOTIFICATION EMAIL]', emailErr)
    }

    return NextResponse.json({
      success: true,
      message: 'Votre signature a été enregistrée avec succès.',
      quoteNumber: sigRequest.quote.number,
    })
  } catch (err) {
    console.error('[POST /api/signature/[token]/sign]', err)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
