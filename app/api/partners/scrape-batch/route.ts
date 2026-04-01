import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { scrapeEmail } from '@/lib/scrape-email'

export const maxDuration = 300

const BATCH_SIZE = 50

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as { role?: string }).role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchId } = await req.json()
  if (!searchId) return NextResponse.json({ error: 'searchId requis' }, { status: 400 })

  const search = await prisma.partnerSearch.findUnique({ where: { id: searchId } })
  if (!search) return NextResponse.json({ error: 'Recherche introuvable' }, { status: 404 })
  if (search.scrapingStatus === 'DONE') return NextResponse.json({ status: 'already_done' })

  // Get next batch of partners without email
  const partners = await prisma.partner.findMany({
    where: { searchId, email: null, website: { not: null } },
    select: { id: true, website: true },
    take: BATCH_SIZE,
  })

  if (partners.length === 0) {
    // No more to scrape — mark as done, delete those without email
    await prisma.partner.deleteMany({ where: { searchId, email: null } })
    const finalCount = await prisma.partner.count({ where: { searchId } })
    await prisma.partnerSearch.update({
      where: { id: searchId },
      data: { scrapingStatus: 'DONE', resultCount: finalCount, scrapedCount: search.totalToScrape },
    })
    return NextResponse.json({ status: 'done', emailsFound: finalCount, remaining: 0 })
  }

  // Scrape in parallel sub-batches of 10
  let found = 0
  const subBatchSize = 10

  for (let i = 0; i < partners.length; i += subBatchSize) {
    const subBatch = partners.slice(i, i + subBatchSize)
    const results = await Promise.all(
      subBatch.map(async p => {
        const email = await scrapeEmail(p.website!)
        return { id: p.id, email }
      })
    )

    for (const r of results) {
      if (r.email) {
        await prisma.partner.update({ where: { id: r.id }, data: { email: r.email } })
        found++
      }
    }
  }

  // Update progress
  const newScrapedCount = search.scrapedCount + partners.length
  const remaining = await prisma.partner.count({ where: { searchId, email: null, website: { not: null } } })

  if (remaining === 0) {
    // All done — cleanup partners without email
    await prisma.partner.deleteMany({ where: { searchId, email: null } })
    const finalCount = await prisma.partner.count({ where: { searchId } })
    await prisma.partnerSearch.update({
      where: { id: searchId },
      data: { scrapingStatus: 'DONE', resultCount: finalCount, scrapedCount: newScrapedCount },
    })
    return NextResponse.json({ status: 'done', emailsFound: finalCount, remaining: 0, batchFound: found })
  }

  await prisma.partnerSearch.update({
    where: { id: searchId },
    data: { scrapedCount: newScrapedCount },
  })

  return NextResponse.json({
    status: 'scraping',
    batchFound: found,
    scraped: newScrapedCount,
    remaining,
    total: search.totalToScrape,
  })
}
