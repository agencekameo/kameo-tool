import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const where: Record<string, unknown> = { projectId: id }
  if (session.user.role !== 'ADMIN') where.uploadedBy = session.user.id
  const invoices = await prisma.projectInvoice.findMany({
    where,
    include: { uploader: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(invoices)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { filename, fileUrl, amount, notes } = await req.json()
  const invoice = await prisma.projectInvoice.create({
    data: { projectId: id, uploadedBy: session.user.id, filename, fileUrl, amount: amount || null, notes: notes || null },
    include: { uploader: { select: { id: true, name: true } } },
  })
  return NextResponse.json(invoice)
}
