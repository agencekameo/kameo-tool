import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const data = await req.json()

  const updateData: Record<string, unknown> = {}
  if (data.amount !== undefined) updateData.amount = data.amount
  if (data.type !== undefined) updateData.type = data.type
  if (data.date !== undefined) updateData.date = new Date(data.date)
  if (data.notes !== undefined) updateData.notes = data.notes
  if (data.paid !== undefined) updateData.paid = data.paid
  if (data.prospectId !== undefined) updateData.prospectId = data.prospectId

  const commission = await prisma.commercialCommission.update({
    where: { id },
    data: updateData,
    include: {
      prospect: { select: { name: true } },
    },
  })

  return NextResponse.json(commission)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  await prisma.commercialCommission.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
