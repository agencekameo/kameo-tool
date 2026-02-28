import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createLog } from '@/lib/log'
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

  // Auto-create a group conversation for this project
  try {
    await prisma.conversation.create({
      data: {
        name: project.name,
        isGroup: true,
        projectId: project.id,
        participants: {
          create: [{ userId: session.user.id }],
        },
      },
    })
  } catch {
    // Non-blocking: conversation creation failure should not break project creation
  }

  await createLog(session.user.id, 'CRÉÉ', 'Projet', project.id, project.name)
  return NextResponse.json(project)
}
