import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await prisma.user.update({ where: { id: session.user.id }, data: { lastSeen: new Date() } })
  return NextResponse.json({ ok: true })
}
