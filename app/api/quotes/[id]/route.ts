import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { items: { orderBy: { position: 'asc' } }, client: true, createdBy: { select: { id: true, name: true } } },
  })
  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(quote)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  // Delete existing items and recreate
  if (body.items) {
    await prisma.quoteItem.deleteMany({ where: { quoteId: id } })
    await prisma.quoteItem.createMany({
      data: body.items.map((item: { description: string; unit?: string; quantity: number; unitPrice: number; tva: number }, i: number) => ({
        quoteId: id,
        description: item.description,
        unit: item.unit || 'forfait',
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || 0,
        tva: item.tva || 20,
        position: i,
      })),
    })
  }
  const data: Record<string, unknown> = {}
  if (body.clientId !== undefined) data.clientId = body.clientId || null
  if (body.clientName) data.clientName = body.clientName
  if (body.clientEmail !== undefined) data.clientEmail = body.clientEmail || null
  if (body.clientAddress !== undefined) data.clientAddress = body.clientAddress || null
  if (body.subject) data.subject = body.subject
  if (body.status) data.status = body.status
  if (body.validUntil !== undefined) data.validUntil = body.validUntil ? new Date(body.validUntil) : null
  if (body.notes !== undefined) data.notes = body.notes || null
  if (body.discount !== undefined) data.discount = body.discount || 0
  const quote = await prisma.quote.update({
    where: { id },
    data,
    include: { items: { orderBy: { position: 'asc' } }, client: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true } } },
  })
  return NextResponse.json(quote)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  await prisma.quote.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
