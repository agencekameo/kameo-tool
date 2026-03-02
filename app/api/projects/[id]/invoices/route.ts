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
    include: {
      uploader: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true, role: true, avatar: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(invoices)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { filename, fileUrl, amount, notes, assigneeId } = await req.json()
  const invoice = await prisma.projectInvoice.create({
    data: {
      projectId: id,
      uploadedBy: session.user.id,
      assigneeId: assigneeId || null,
      filename,
      fileUrl,
      amount: amount || null,
      notes: notes || null,
    },
    include: {
      uploader: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true, role: true, avatar: true } },
    },
  })
  return NextResponse.json(invoice)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await params
  const { invoiceId, filename, fileUrl, amount, notes } = await req.json()
  const invoice = await prisma.projectInvoice.update({
    where: { id: invoiceId },
    data: {
      filename,
      fileUrl,
      amount: amount || null,
      notes: notes || null,
    },
    include: {
      uploader: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true, role: true, avatar: true } },
    },
  })
  return NextResponse.json(invoice)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await params
  const { invoiceId } = await req.json()
  await prisma.projectInvoice.delete({ where: { id: invoiceId } })
  return NextResponse.json({ ok: true })
}
