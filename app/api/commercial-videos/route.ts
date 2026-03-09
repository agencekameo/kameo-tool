import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const videos = await prisma.commercialVideo.findMany({
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(videos)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await req.json()
  const { title, url, description, category } = data

  const video = await prisma.commercialVideo.create({
    data: {
      title,
      url,
      description: description || null,
      category: category || null,
    },
  })

  return NextResponse.json(video)
}
