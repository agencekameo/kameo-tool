import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const { userId } = await req.json()
  await prisma.project.update({
    where: { id },
    data: { assignees: { connect: { id: userId } } },
  })

  // Also add the user to the project's group conversation
  try {
    const conv = await prisma.conversation.findUnique({ where: { projectId: id } })
    if (conv) {
      await prisma.conversationMember.upsert({
        where: { conversationId_userId: { conversationId: conv.id, userId } },
        update: {},
        create: { conversationId: conv.id, userId },
      })
    }
  } catch { /* Non-blocking */ }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const { userId } = await req.json()
  await prisma.project.update({
    where: { id },
    data: { assignees: { disconnect: { id: userId } } },
  })
  return NextResponse.json({ ok: true })
}
