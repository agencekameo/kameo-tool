import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createNotification } from '@/lib/notifications'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || (session.user as { role?: string }).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params

  let body: { userId: string; price?: number | null; deadline?: string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { userId, price, deadline } = body
  if (!userId) return NextResponse.json({ error: 'userId requis' }, { status: 400 })

  // Check if the user is a DESIGNER → no price
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  if (!user) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

  const assignment = await prisma.projectAssignee.create({
    data: {
      projectId: id,
      userId,
      price: user.role === 'DESIGNER' ? null : (price ?? null),
      deadline: deadline ? new Date(deadline) : null,
      status: 'EN_ATTENTE',
    },
    include: { user: { select: { id: true, name: true, email: true, role: true, avatar: true } } },
  })

  // Notify the assigned freelancer
  const project = await prisma.project.findUnique({ where: { id }, select: { name: true } })
  createNotification({
    userId,
    type: 'MISSION_NEW',
    title: 'Nouvelle mission',
    message: `Vous avez été assigné au projet "${project?.name ?? 'Sans nom'}"`,
    link: `/projects/${id}`,
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

  return NextResponse.json(assignment)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || (session.user as { role?: string }).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params

  let body: { userId: string; price?: number | null; deadline?: string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { userId, price, deadline, status } = body as { userId: string; price?: number | null; deadline?: string | null; status?: string }
  if (!userId) return NextResponse.json({ error: 'userId requis' }, { status: 400 })

  const data: Record<string, unknown> = {}
  if (price !== undefined) data.price = price
  if (deadline !== undefined) data.deadline = deadline ? new Date(deadline) : null
  if (status !== undefined) {
    data.status = status
    if (status === 'EN_ATTENTE') {
      data.counterPrice = null
      data.counterDeadline = null
      data.counterNote = null
      data.respondedAt = null
    }
  }

  const assignment = await prisma.projectAssignee.update({
    where: { projectId_userId: { projectId: id, userId } },
    data,
    include: { user: { select: { id: true, name: true, email: true, role: true, avatar: true } } },
  })

  // Notify the freelancer if the proposal was changed
  if (Object.keys(data).length > 0 && (price !== undefined || deadline !== undefined || status === 'EN_ATTENTE')) {
    const project = await prisma.project.findUnique({ where: { id }, select: { name: true } })
    createNotification({
      userId,
      type: 'MISSION_UPDATED',
      title: 'Mission mise à jour',
      message: `La proposition pour "${project?.name ?? 'Sans nom'}" a été modifiée`,
      link: `/projects/${id}`,
    })
  }

  return NextResponse.json(assignment)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || (session.user as { role?: string }).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params

  let body: { userId: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { userId } = body
  if (!userId) return NextResponse.json({ error: 'userId requis' }, { status: 400 })

  await prisma.projectAssignee.delete({
    where: { projectId_userId: { projectId: id, userId } },
  })

  return NextResponse.json({ ok: true })
}
