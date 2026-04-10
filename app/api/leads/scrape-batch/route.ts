import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { scrapeEmail } from '@/lib/scrape-email'

export const maxDuration = 300

const BATCH_SIZE = 50

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchId } = await req.json()
  if (!searchId) return NextResponse.json({ error: 'searchId requis' }, { status: 400 })

  const search = await prisma.leadSearch.findUnique({ where: { id: searchId } })
  if (!search) return NextResponse.json({ error: 'Recherche introuvable' }, { status: 404 })
  if (search.scrapingStatus === 'DONE') return NextResponse.json({ status: 'done' })

  // Get next batch of prospects without email but with website
  const prospects = await prisma.prospect.findMany({
    where: { leadSearchId: searchId, email: null, website: { not: null } },
    select: { id: true, website: true },
    take: BATCH_SIZE,
  })

  if (prospects.length === 0) {
    // All done
    const withEmail = await prisma.prospect.count({ where: { leadSearchId: searchId, email: { not: null } } })
    const total = await prisma.prospect.count({ where: { leadSearchId: searchId } })
    await prisma.leadSearch.update({
      where: { id: searchId },
      data: { scrapingStatus: 'DONE', withEmail, resultCount: total, scrapedCount: search.totalToScrape },
    })
    return NextResponse.json({ status: 'done', withEmail, total, remaining: 0 })
  }

  // Scrape in parallel sub-batches of 10
  let found = 0
  const subBatchSize = 10

  for (let i = 0; i < prospects.length; i += subBatchSize) {
    const subBatch = prospects.slice(i, i + subBatchSize)
    const results = await Promise.all(
      subBatch.map(async p => {
        const email = await scrapeEmail(p.website!)
        return { id: p.id, email }
      })
    )

    for (const r of results) {
      if (r.email) {
        await prisma.prospect.update({ where: { id: r.id }, data: { email: r.email } })
        found++
      }
    }
  }

  // Update progress — recount actual totals to avoid drift
  const remaining = await prisma.prospect.count({ where: { leadSearchId: searchId, email: null, website: { not: null } } })
  const totalWithSite = await prisma.prospect.count({ where: { leadSearchId: searchId, website: { not: null } } })
  const scraped = totalWithSite - remaining
  const withEmail = await prisma.prospect.count({ where: { leadSearchId: searchId, email: { not: null } } })

  if (remaining === 0) {
    const total = await prisma.prospect.count({ where: { leadSearchId: searchId } })
    await prisma.leadSearch.update({
      where: { id: searchId },
      data: { scrapingStatus: 'DONE', withEmail, resultCount: total, scrapedCount: totalWithSite, totalToScrape: totalWithSite },
    })
    return NextResponse.json({ status: 'done', withEmail, total, remaining: 0, batchFound: found })
  }

  await prisma.leadSearch.update({
    where: { id: searchId },
    data: { scrapedCount: scraped, totalToScrape: totalWithSite },
  })

  return NextResponse.json({
    status: 'scraping',
    batchFound: found,
    scraped,
    remaining,
    total: totalWithSite,
  })
}
