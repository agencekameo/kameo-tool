import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

function getNextQuoteNumber(lastNumber: string | null): string {
  const year = new Date().getFullYear()
  if (!lastNumber) return `DEV-${year}-001`
  const parts = lastNumber.split('-')
  const num = parseInt(parts[2] || '0') + 1
  return `DEV-${year}-${String(num).padStart(3, '0')}`
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const quotes = await prisma.quote.findMany({
    include: {
      items: { orderBy: { position: 'asc' } },
      client: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(quotes)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const last = await prisma.quote.findFirst({ orderBy: { createdAt: 'desc' }, select: { number: true } })
  const number = getNextQuoteNumber(last?.number ?? null)
  const quote = await prisma.quote.create({
    data: {
      number,
      clientId: body.clientId || null,
      clientName: body.clientName,
      clientEmail: body.clientEmail || null,
      clientAddress: body.clientAddress || null,
      subject: body.subject,
      status: body.status || 'BROUILLON',
      validUntil: body.validUntil ? new Date(body.validUntil) : null,
      notes: body.notes || null,
      discount: body.discount || 0,
      createdById: session.user.id,
      items: {
        create: (body.items || []).map((item: { description: string; unit?: string; quantity: number; unitPrice: number; tva: number; position: number }, i: number) => ({
          description: item.description,
          unit: item.unit || 'forfait',
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || 0,
          tva: item.tva || 20,
          position: i,
        })),
      },
    },
    include: { items: true, client: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true } } },
  })
  return NextResponse.json(quote)
}
