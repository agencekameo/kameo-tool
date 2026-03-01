import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createLog } from '@/lib/log'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const clients = await prisma.client.findMany({
      include: {
        projects: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(clients)
  } catch (err) {
    console.error('[GET /api/clients]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const client = await prisma.client.create({ data: body, include: { projects: true } })
  await createLog(session.user.id, 'CRÉÉ', 'Client', client.id, client.name)
  return NextResponse.json(client)
}
