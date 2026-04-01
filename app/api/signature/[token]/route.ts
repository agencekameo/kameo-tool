import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Public endpoint — no auth required.
 * Returns quote data for the signing page.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  try {
    const sigRequest = await prisma.signatureRequest.findUnique({
      where: { token },
      include: {
        quote: {
          include: {
            items: { orderBy: { position: 'asc' } },
          },
        },
      },
    })

    if (!sigRequest) {
      return NextResponse.json({ error: 'not_found', message: 'Lien de signature introuvable.' }, { status: 404 })
    }

    // Check if already signed
    if (sigRequest.usedAt) {
      return NextResponse.json({
        error: 'already_signed',
        message: 'Ce devis a déjà été signé.',
        signedAt: sigRequest.signedAt,
        quoteNumber: sigRequest.quote.number,
      }, { status: 410 })
    }

    // Check expiration
    if (new Date() > sigRequest.expiresAt) {
      return NextResponse.json({
        error: 'expired',
        message: 'Ce lien de signature a expiré.',
        quoteNumber: sigRequest.quote.number,
      }, { status: 410 })
    }

    // Check if quote is already accepted
    if (sigRequest.quote.status === 'ACCEPTE') {
      return NextResponse.json({
        error: 'already_signed',
        message: 'Ce devis a déjà été accepté.',
        quoteNumber: sigRequest.quote.number,
      }, { status: 410 })
    }

    const quote = sigRequest.quote

    // Return sanitized data (no internal IDs exposed beyond what's needed)
    return NextResponse.json({
      quoteNumber: quote.number,
      clientName: quote.clientName,
      clientEmail: quote.clientEmail,
      clientAddress: quote.clientAddress,
      subject: quote.subject,
      validUntil: quote.validUntil,
      deliveryDays: quote.deliveryDays,
      clientLogo: quote.clientLogo,
      notes: quote.notes,
      discount: quote.discount,
      items: quote.items.map(item => ({
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        tva: item.tva,
      })),
      signerName: `${sigRequest.signerFirstName} ${sigRequest.signerLastName}`,
      createdAt: quote.createdAt,
    })
  } catch (err) {
    console.error('[GET /api/signature/[token]]', err)
    return NextResponse.json({ error: 'server_error', message: 'Erreur serveur.' }, { status: 500 })
  }
}
