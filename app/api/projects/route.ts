import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const projects = await prisma.project.findMany({
    include: { client: true, tasks: true },
    orderBy: { updatedAt: 'desc' },
  })
  return NextResponse.json(projects)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const project = await prisma.project.create({
    data: { ...body, createdById: session.user.id },
    include: { client: true, tasks: true },
  })
  return NextResponse.json(project)
}
