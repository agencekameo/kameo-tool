import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { generateQuotePdf } from '@/lib/quote-pdf'
import { createSignatureRequest, uploadDocument, addSigner, activateSignatureRequest } from '@/lib/yousign'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const body = await req.json()
    const { signerFirstName, signerLastName, signerEmail, signerPhone } = body

    if (!signerFirstName || !signerLastName || !signerEmail) {
      return NextResponse.json({ error: 'Prénom, nom et email du signataire requis' }, { status: 400 })
    }

    // 1. Fetch quote from DB
    const quote = await prisma.quote.findUnique({
      where: { id },
      include: { items: { orderBy: { position: 'asc' } } },
    })
    if (!quote) return NextResponse.json({ error: 'Devis introuvable' }, { status: 404 })

    // 2. Generate PDF
    const { buffer: pdfBuffer, pageCount } = await generateQuotePdf({
      number: quote.number,
      clientName: quote.clientName,
      clientEmail: quote.clientEmail,
      clientAddress: quote.clientAddress,
      subject: quote.subject,
      status: quote.status,
      validUntil: quote.validUntil,
      notes: quote.notes,
      discount: quote.discount,
      items: quote.items.map(i => ({
        description: i.description,
        unit: i.unit,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
    })

    // 3. Create Yousign signature request
    const sigRequest = await createSignatureRequest(`Devis ${quote.number} — ${quote.subject}`)

    // 4. Upload PDF document
    const document = await uploadDocument(sigRequest.id, pdfBuffer, `devis-${quote.number}.pdf`)

    // 5. Add signer with signature field on last page
    await addSigner(
      sigRequest.id,
      document.id,
      {
        firstName: signerFirstName,
        lastName: signerLastName,
        email: signerEmail,
        phone: signerPhone || undefined,
      },
      pageCount, // signature on last page
    )

    // 6. Activate the signature request (sends email)
    const activated = await activateSignatureRequest(sigRequest.id)

    // 7. Update quote status to ENVOYE
    await prisma.quote.update({
      where: { id },
      data: { status: 'ENVOYE' },
    })

    return NextResponse.json({
      success: true,
      signatureRequestId: sigRequest.id,
      status: activated.status,
      message: `Demande de signature envoyée à ${signerEmail}`,
    })
  } catch (err) {
    console.error('[POST /api/quotes/[id]/yousign]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur lors de l\'envoi pour signature' },
      { status: 500 },
    )
  }
}
