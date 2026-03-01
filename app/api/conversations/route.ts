import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

const PARTICIPANT_SELECT = {
  include: {
    user: { select: { id: true, name: true, avatar: true, lastSeen: true } },
  },
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const conversations = await prisma.conversation.findMany({
    where: {
      participants: {
        some: { userId: session.user.id, archivedAt: null },
      },
    },
    include: {
      participants: PARTICIPANT_SELECT,
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { sender: { select: { id: true, name: true } } },
      },
      project: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(conversations)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const participantIds: string[] = Array.from(new Set([session.user.id, ...(body.participantIds || [])]))
  const isGroup = body.isGroup || participantIds.length > 2

  // For 1-to-1 conversations, check if one already exists
  if (!isGroup && participantIds.length === 2) {
    const existing = await prisma.conversation.findFirst({
      where: {
        isGroup: false,
        projectId: null,
        AND: participantIds.map(uid => ({
          participants: { some: { userId: uid } },
        })),
        participants: { every: { userId: { in: participantIds } } },
      },
      include: {
        participants: PARTICIPANT_SELECT,
        messages: { take: 1, orderBy: { createdAt: 'desc' } },
        project: { select: { id: true, name: true } },
      },
    })
    if (existing) return NextResponse.json(existing)
  }

  const conversation = await prisma.conversation.create({
    data: {
      name: body.name || null,
      isGroup,
      participants: {
        create: participantIds.map((userId: string) => ({ userId })),
      },
    },
    include: {
      participants: PARTICIPANT_SELECT,
      messages: { take: 1 },
      project: { select: { id: true, name: true } },
    },
  })
  return NextResponse.json(conversation)
}
