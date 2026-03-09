import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createNotification } from '@/lib/notifications'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const messages = await prisma.message.findMany({
    where: { conversationId: id },
    include: { sender: { select: { id: true, name: true, avatar: true } } },
    orderBy: { createdAt: 'asc' },
    take: 100,
  })
  // Update lastReadAt
  await prisma.conversationMember.updateMany({
    where: { conversationId: id, userId: session.user.id },
    data: { lastReadAt: new Date() },
  })
  return NextResponse.json(messages)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const message = await prisma.message.create({
    data: {
      conversationId: id,
      senderId: session.user.id,
      content: body.content || null,
      fileUrl: body.fileUrl || null,
      fileType: body.fileType || null,
      fileName: body.fileName || null,
    },
    include: { sender: { select: { id: true, name: true, avatar: true } } },
  })

  // Notify all conversation participants except the sender
  try {
    const members = await prisma.conversationMember.findMany({
      where: { conversationId: id, userId: { not: session.user.id } },
      select: { userId: true },
    })
    const conv = await prisma.conversation.findUnique({ where: { id }, select: { name: true } })
    const senderName = message.sender.name
    const preview = body.content ? (body.content.length > 50 ? body.content.slice(0, 50) + '…' : body.content) : 'Fichier partagé'
    for (const member of members) {
      createNotification({
        userId: member.userId,
        type: 'MESSAGE',
        title: `Message de ${senderName}`,
        message: conv?.name ? `${conv.name} : ${preview}` : preview,
        link: `/messagerie`,
      })
    }
  } catch { /* Non-blocking */ }

  return NextResponse.json(message)
}
