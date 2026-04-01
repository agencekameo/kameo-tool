import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// DELETE — supprime la conversation pour tout le monde (admin) ou quitte pour soi
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const isAdmin = (session.user as { role?: string }).role === 'ADMIN'

  if (isAdmin) {
    // Admin: supprime la conversation entièrement
    await prisma.conversation.delete({ where: { id } })
  } else {
    // Autres: quitte seulement la conversation (retire sa participation)
    await prisma.conversationMember.deleteMany({
      where: { conversationId: id, userId: session.user.id },
    })
  }
  return NextResponse.json({ success: true })
}

// POST — ajouter un participant à la conversation
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId requis' }, { status: 400 })

  // Check conversation exists and user is a member
  const conv = await prisma.conversation.findUnique({ where: { id }, include: { participants: { select: { userId: true } } } })
  if (!conv) return NextResponse.json({ error: 'Conversation introuvable' }, { status: 404 })

  const isMember = conv.participants.some(p => p.userId === session.user.id)
  if (!isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Check if already a participant
  const alreadyIn = conv.participants.some(p => p.userId === userId)
  if (alreadyIn) return NextResponse.json({ error: 'Déjà participant' }, { status: 400 })

  await prisma.conversationMember.create({ data: { conversationId: id, userId } })

  const updated = await prisma.conversation.findUnique({
    where: { id },
    include: {
      participants: { where: { archivedAt: null }, include: { user: { select: { id: true, name: true, avatar: true } } } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { content: true, createdAt: true } },
      project: { select: { name: true } },
    },
  })
  return NextResponse.json(updated)
}

// PATCH — archive ou désarchive la conversation pour l'utilisateur courant
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { archive } = await req.json()

  await prisma.conversationMember.updateMany({
    where: { conversationId: id, userId: session.user.id },
    data: { archivedAt: archive ? new Date() : null },
  })
  return NextResponse.json({ success: true })
}
