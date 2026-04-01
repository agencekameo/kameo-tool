import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const redaction = await prisma.redaction.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, name: true, client: { select: { name: true, company: true } } } },
      createdBy: { select: { name: true } },
    },
  })

  if (!redaction) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(redaction)
}
