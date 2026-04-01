import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as { role?: string }).role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  // Delete all partners linked to this search
  await prisma.partner.deleteMany({ where: { searchId: id } })
  // Delete the search itself
  await prisma.partnerSearch.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
