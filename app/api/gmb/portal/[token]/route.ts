import { prisma } from '@/lib/db'
import { put } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'

// GET: public endpoint to get portal info
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const portal = await prisma.gmbClientPortal.findUnique({
    where: { token },
    include: {
      project: {
        select: { locationName: true, businessName: true, id: true },
      },
    },
  })

  if (!portal || !portal.active) {
    return NextResponse.json({ error: 'Portail non trouvé ou désactivé' }, { status: 404 })
  }

  // Count existing photos from portal
  const photoCount = await prisma.gmbScheduledPhoto.count({
    where: { projectId: portal.projectId, fromPortal: true },
  })

  return NextResponse.json({
    portal: {
      clientName: portal.clientName,
      instructions: portal.instructions,
      maxPhotos: portal.maxPhotos,
      businessName: portal.project.businessName || portal.project.locationName,
    },
    photoCount,
    remaining: Math.max(0, portal.maxPhotos - photoCount),
  })
}

// POST: public endpoint for client to upload photos
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const portal = await prisma.gmbClientPortal.findUnique({
    where: { token },
    include: { project: true },
  })

  if (!portal || !portal.active) {
    return NextResponse.json({ error: 'Portail non trouvé ou désactivé' }, { status: 404 })
  }

  const photoCount = await prisma.gmbScheduledPhoto.count({
    where: { projectId: portal.projectId, fromPortal: true },
  })

  if (photoCount >= portal.maxPhotos) {
    return NextResponse.json({ error: 'Limite de photos atteinte' }, { status: 400 })
  }

  const formData = await req.formData()
  const files = formData.getAll('files') as File[]

  if (files.length === 0) {
    return NextResponse.json({ error: 'Aucun fichier' }, { status: 400 })
  }

  const remaining = portal.maxPhotos - photoCount
  const filesToProcess = files.slice(0, remaining)
  const results = []

  for (const file of filesToProcess) {
    const blob = await put(`gmb-portal/${portal.projectId}/${Date.now()}-${file.name}`, file, { access: 'public' })

    // Auto-schedule for next available slot (spread across upcoming days)
    const scheduledAt = new Date()
    scheduledAt.setDate(scheduledAt.getDate() + 1 + results.length) // One per day starting tomorrow
    scheduledAt.setHours(10, 0, 0, 0)

    const photo = await prisma.gmbScheduledPhoto.create({
      data: {
        projectId: portal.projectId,
        imageUrl: blob.url,
        category: 'ADDITIONAL',
        scheduledAt,
        status: 'PLANIFIE',
        fromPortal: true,
      },
    })
    results.push(photo)
  }

  return NextResponse.json({ uploaded: results.length, photos: results })
}
