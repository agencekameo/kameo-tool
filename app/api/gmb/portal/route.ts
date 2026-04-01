import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// Create or update portal for a project
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, clientName, clientEmail, instructions, maxPhotos, active } = await req.json()
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  const portal = await prisma.gmbClientPortal.upsert({
    where: { projectId },
    create: {
      projectId,
      clientName,
      clientEmail,
      instructions,
      maxPhotos: maxPhotos || 20,
    },
    update: {
      clientName,
      clientEmail,
      instructions,
      maxPhotos: maxPhotos ?? undefined,
      active: active ?? undefined,
    },
  })

  return NextResponse.json({ portal })
}
