import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const docs = await prisma.projectDocument.findMany({
    where: { projectId: id },
    include: { uploadedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(docs)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { name, url, category } = await req.json()
  if (!name || !url || !category) {
    return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
  }
  const doc = await prisma.projectDocument.create({
    data: { projectId: id, name, url, category, uploadedById: session.user.id },
    include: { uploadedBy: { select: { id: true, name: true } } },
  })
  return NextResponse.json(doc)
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { docId } = await req.json()
  await prisma.projectDocument.delete({ where: { id: docId } })
  return NextResponse.json({ success: true })
}
