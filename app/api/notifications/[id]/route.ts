import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const notification = await prisma.notification.updateMany({
    where: { id, userId: session.user.id },
    data: { read: true },
  })

  return NextResponse.json(notification)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  await prisma.notification.deleteMany({
    where: { id, userId: session.user.id },
  })

  return NextResponse.json({ ok: true })
}
