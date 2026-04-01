import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const locationId = req.nextUrl.searchParams.get('locationId')
  if (!locationId) return NextResponse.json({ error: 'locationId required' }, { status: 400 })

  const project = await prisma.gmbProject.findUnique({
    where: { locationId },
    include: { clientPortal: true },
  })
  return NextResponse.json({ project })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await req.json()
  const { locationId, locationName, accountId, ...fields } = data

  if (!locationId) return NextResponse.json({ error: 'locationId required' }, { status: 400 })

  const project = await prisma.gmbProject.upsert({
    where: { locationId },
    create: {
      locationId,
      locationName: locationName || '',
      accountId: accountId || '',
      createdById: session.user.id,
      ...fields,
    },
    update: fields,
    include: { clientPortal: true },
  })

  return NextResponse.json({ project })
}
