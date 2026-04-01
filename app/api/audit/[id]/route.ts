import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// Public endpoint — no auth required (for shareable audit reports)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const audit = await prisma.audit.findUnique({
    where: { id },
    include: { createdBy: { select: { name: true } }, project: { include: { client: { select: { name: true } } } } },
  })

  if (!audit) {
    return NextResponse.json({ error: 'Audit non trouvé' }, { status: 404 })
  }

  return NextResponse.json(audit)
}
