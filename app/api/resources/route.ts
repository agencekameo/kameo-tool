import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const resources = await prisma.resource.findMany({
    orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
  })
  return NextResponse.json(resources)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const resource = await prisma.resource.create({ data: body })
  return NextResponse.json(resource)
}
