import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { put } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  const photos = await prisma.gmbScheduledPhoto.findMany({
    where: { projectId },
    orderBy: { scheduledAt: 'asc' },
  })
  return NextResponse.json({ photos })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const projectId = formData.get('projectId') as string
  const scheduledAt = formData.get('scheduledAt') as string
  const category = (formData.get('category') as string) || 'ADDITIONAL'
  const caption = formData.get('caption') as string | null
  const file = formData.get('file') as File

  if (!projectId || !file || !scheduledAt) {
    return NextResponse.json({ error: 'projectId, file, scheduledAt required' }, { status: 400 })
  }

  const blob = await put(`gmb-scheduled/${Date.now()}-${file.name}`, file, { access: 'public' })

  const photo = await prisma.gmbScheduledPhoto.create({
    data: {
      projectId,
      imageUrl: blob.url,
      caption,
      category,
      scheduledAt: new Date(scheduledAt),
      status: 'PLANIFIE',
    },
  })
  return NextResponse.json({ photo })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await prisma.gmbScheduledPhoto.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
