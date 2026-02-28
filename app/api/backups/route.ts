import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const backups = await prisma.siteBackup.findMany({
    include: { client: { select: { id: true, name: true } } },
    orderBy: { backupDate: 'desc' },
  })
  return NextResponse.json(backups)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const backup = await prisma.siteBackup.create({
    data: {
      clientName: body.clientName,
      clientId: body.clientId || null,
      url: body.url || null,
      provider: body.provider || null,
      type: body.type || 'FULL',
      size: body.size || null,
      status: body.status || 'OK',
      backupDate: new Date(body.backupDate),
      notes: body.notes || null,
    },
    include: { client: { select: { id: true, name: true } } },
  })
  return NextResponse.json(backup)
}
