import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { demoGuard } from '@/lib/demo'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const projects = await prisma.smallProject.findMany({
      include: {
        client: { select: { id: true, name: true } },
        freelance: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: { signedAt: 'desc' },
    })
    return NextResponse.json(projects)
  } catch (err) {
    console.error('[GET /api/small-projects]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const guard = demoGuard(session); if (guard) return guard
  const data = await req.json()
  const project = await prisma.smallProject.create({
    data: {
      name: data.name,
      clientId: data.clientId,
      price: parseFloat(data.price),
      charges: data.charges ? parseFloat(data.charges) : 0,
      description: data.description || null,
      signedAt: new Date(data.signedAt),
      status: data.status || 'NON_COMMENCE',
      freelanceId: data.freelanceId || null,
    },
    include: {
      client: { select: { id: true, name: true } },
      freelance: { select: { id: true, name: true, avatar: true } },
    },
  })
  return NextResponse.json(project)
}
