import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const conversations = await prisma.conversation.findMany({
    where: {
      participants: { some: { userId: session.user.id } },
    },
    include: {
      participants: { include: { user: { select: { id: true, name: true, avatar: true } } } },
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
  const conversation = await prisma.conversation.create({
    data: {
      name: body.name || null,
      isGroup: body.isGroup || participantIds.length > 2,
      participants: {
        create: participantIds.map((userId: string) => ({ userId })),
      },
    },
    include: {
      participants: { include: { user: { select: { id: true, name: true, avatar: true } } } },
      messages: { take: 1 },
    },
  })
  return NextResponse.json(conversation)
}
