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
