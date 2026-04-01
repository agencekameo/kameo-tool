import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  const posts = await prisma.gmbScheduledPost.findMany({
    where: { projectId },
    orderBy: { scheduledAt: 'asc' },
  })
  return NextResponse.json({ posts })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, content, topicType, scheduledAt, status, aiGenerated } = await req.json()
  if (!projectId || !content || !scheduledAt) {
    return NextResponse.json({ error: 'projectId, content, scheduledAt required' }, { status: 400 })
  }

  const post = await prisma.gmbScheduledPost.create({
    data: {
      projectId,
      content,
      topicType: topicType || 'STANDARD',
      scheduledAt: new Date(scheduledAt),
      status: status || 'PLANIFIE',
      aiGenerated: aiGenerated || false,
    },
  })
  return NextResponse.json({ post })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await prisma.gmbScheduledPost.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
