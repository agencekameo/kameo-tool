import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')

  const speeches = await prisma.commercialSpeech.findMany({
    where: userId ? { userId } : undefined,
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json(speeches)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await req.json()
  const { userId, title, content } = data

  const speech = await prisma.commercialSpeech.create({
    data: {
      userId,
      title,
      content,
    },
  })

  return NextResponse.json(speech)
}
