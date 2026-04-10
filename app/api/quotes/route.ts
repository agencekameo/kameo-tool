import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { demoGuard, demoWhere } from '@/lib/demo'
import { NextRequest, NextResponse } from 'next/server'

async function getNextQuoteNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `DEVIS-${year}-`
  // Find the highest number for this year by sorting by number descending
  const last = await prisma.quote.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: 'desc' },
    select: { number: true },
  })
  if (!last) return `${prefix}001`
  const num = parseInt(last.number.split('-').pop() || '0') + 1
  return `${prefix}${String(num).padStart(3, '0')}`
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const quotes = await prisma.quote.findMany({
      where: demoWhere(session),
      include: {
        items: { orderBy: { position: 'asc' } },
        client: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { signatureRequests: true } },
        signatureRequests: { where: { scheduledSent: false, scheduledAt: { not: null } }, select: { id: true, scheduledAt: true, signerEmail: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(quotes)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[GET /api/quotes]', message, err)
    return NextResponse.json({ error: `Erreur serveur: ${message}` }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const guard = demoGuard(session); if (guard) return guard
  try {
    const body = await req.json()
    const number = await getNextQuoteNumber()
    const quote = await prisma.quote.create({
      data: {
        number,
        clientId: body.clientId || null,
        clientName: body.clientName,
        clientEmail: body.clientEmail || null,
        clientAddress: body.clientAddress || null,
        clientLogo: body.clientLogo || null,
        subject: body.subject || `Devis ${body.clientName || ''}`.trim(),
        status: body.status || 'EN_ATTENTE',
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
        notes: body.notes || null,
        discount: Math.max(0, Number(body.discount) || 0),
        discountType: body.discountType === 'FIXED' ? 'FIXED' : 'PERCENT',
        paymentTerms: body.paymentTerms || null,
        deliveryDays: body.deliveryDays ? parseInt(body.deliveryDays) : null,
        createdById: session.user.id,
        items: {
          create: (body.items || []).map((item: { description: string; unit?: string; quantity: number; unitPrice: number; tva: number; position: number }, i: number) => ({
            description: item.description,
            unit: item.unit || 'forfait',
            quantity: Math.max(0, Number(item.quantity) || 1),
            unitPrice: Math.max(0, Number(item.unitPrice) || 0),
            tva: Math.max(0, Math.min(100, Number(item.tva) || 20)),
            position: i,
          })),
        },
      },
      include: { items: true, client: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true } } },
    })
    return NextResponse.json(quote)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/quotes]', message, err)
    return NextResponse.json({ error: `Erreur serveur: ${message}` }, { status: 500 })
  }
}
