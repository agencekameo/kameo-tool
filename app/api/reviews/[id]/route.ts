import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { demoGuard } from '@/lib/demo'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const guard = demoGuard(session); if (guard) return guard
  const { id } = await params
  try {
    const body = await req.json()
    const data: Record<string, unknown> = {}
    if ('status' in body) data.status = body.status
    if ('clientName' in body) data.clientName = body.clientName
    const review = await prisma.review.update({ where: { id }, data })
    return NextResponse.json(review)
  } catch (err) {
    console.error('[PATCH /api/reviews]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const guard = demoGuard(session); if (guard) return guard
  const { id } = await params
  await prisma.review.update({ where: { id }, data: { hidden: true } })
  return NextResponse.json({ ok: true })
}
