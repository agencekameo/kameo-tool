import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const doc = await prisma.cahierDesCharges.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(doc)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const doc = await prisma.cahierDesCharges.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.content !== undefined && { content: body.content }),
      ...(body.projectId !== undefined && { projectId: body.projectId || null }),
      ...(body.template !== undefined && { template: body.template }),
    },
    include: {
      project: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })
  return NextResponse.json(doc)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  await prisma.cahierDesCharges.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
