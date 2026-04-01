import { prisma } from '@/lib/db'
import { createGmbPost, uploadGmbMedia } from '@/lib/google-gmb'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const results = { publishedPosts: 0, publishedPhotos: 0, errors: [] as string[] }

  // ── Publish scheduled posts ──
  const pendingPosts = await prisma.gmbScheduledPost.findMany({
    where: {
      status: 'PLANIFIE',
      scheduledAt: { lte: now },
    },
    include: { project: true },
  })

  for (const post of pendingPosts) {
    try {
      await createGmbPost(post.project.accountId, post.project.locationId, {
        summary: post.content,
        topicType: post.topicType,
      })
      await prisma.gmbScheduledPost.update({
        where: { id: post.id },
        data: { status: 'PUBLIE', publishedAt: now },
      })
      results.publishedPosts++
    } catch (err) {
      const msg = `Post ${post.id}: ${err instanceof Error ? err.message : String(err)}`
      console.error('[GMB Cron]', msg)
      results.errors.push(msg)
      await prisma.gmbScheduledPost.update({
        where: { id: post.id },
        data: { status: 'ERREUR', errorMessage: msg },
      })
    }
  }

  // ── Publish scheduled photos ──
  const pendingPhotos = await prisma.gmbScheduledPhoto.findMany({
    where: {
      status: 'PLANIFIE',
      scheduledAt: { lte: now },
    },
    include: { project: true },
  })

  for (const photo of pendingPhotos) {
    try {
      await uploadGmbMedia(photo.project.accountId, photo.project.locationId, photo.imageUrl, photo.category)
      await prisma.gmbScheduledPhoto.update({
        where: { id: photo.id },
        data: { status: 'PUBLIE', publishedAt: now },
      })
      results.publishedPhotos++
    } catch (err) {
      const msg = `Photo ${photo.id}: ${err instanceof Error ? err.message : String(err)}`
      console.error('[GMB Cron]', msg)
      results.errors.push(msg)
      await prisma.gmbScheduledPhoto.update({
        where: { id: photo.id },
        data: { status: 'ERREUR', errorMessage: msg },
      })
    }
  }

  console.log('[GMB Cron] Results:', results)
  return NextResponse.json(results)
}
