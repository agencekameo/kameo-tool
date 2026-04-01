import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { scrapeEmail } from '@/lib/scrape-email'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as { role?: string }).role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { partnerIds } = await req.json()
  if (!Array.isArray(partnerIds) || partnerIds.length === 0) {
    return NextResponse.json({ error: 'partnerIds requis' }, { status: 400 })
  }

  const partners = await prisma.partner.findMany({
    where: { id: { in: partnerIds }, email: null, website: { not: null } },
    select: { id: true, website: true },
  })

  let found = 0
  const batchSize = 10

  for (let i = 0; i < partners.length; i += batchSize) {
    const batch = partners.slice(i, i + batchSize)
    const results = await Promise.all(
      batch.map(async p => {
        const email = await scrapeEmail(p.website!)
        return { id: p.id, email }
      })
    )

    for (const r of results) {
      if (r.email) {
        await prisma.partner.update({ where: { id: r.id }, data: { email: r.email } })
        found++
      } else {
        await prisma.partner.delete({ where: { id: r.id } }).catch(() => {})
      }
    }
  }

  return NextResponse.json({ found, total: partners.length })
}
