import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const docs = await prisma.cahierDesCharges.findMany({
    include: {
      project: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })
  return NextResponse.json(docs)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const doc = await prisma.cahierDesCharges.create({
    data: {
      title: body.title,
      content: body.content,
      prompt: body.prompt || null,
      projectId: body.projectId || null,
      template: body.template || 'standard',
      createdById: session.user.id,
    },
    include: {
      project: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })
  return NextResponse.json(doc)
}
