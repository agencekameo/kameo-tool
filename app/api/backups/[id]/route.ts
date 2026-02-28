import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const backup = await prisma.siteBackup.update({
    where: { id },
    data: {
      ...body,
      backupDate: body.backupDate ? new Date(body.backupDate) : undefined,
      clientId: body.clientId || null,
    },
    include: { client: { select: { id: true, name: true } } },
  })
  return NextResponse.json(backup)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  await prisma.siteBackup.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
