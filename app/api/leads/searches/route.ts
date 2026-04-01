import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = req.nextUrl.searchParams.get('userId') || session.user.id

  const searches = await prisma.leadSearch.findMany({
    where: { userId },
    include: {
      _count: { select: { prospects: true } },
      prospects: { select: { email: true }, where: { email: { not: null } } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(searches.map(s => ({
    id: s.id,
    keyword: s.keyword,
    location: s.location,
    resultCount: s._count.prospects,
    withEmail: s.prospects.length,
    createdAt: s.createdAt,
  })))
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchId } = await req.json()
  if (!searchId) return NextResponse.json({ error: 'searchId requis' }, { status: 400 })

  // Delete all prospects in this search, then the search itself
  await prisma.prospect.deleteMany({ where: { leadSearchId: searchId } })
  await prisma.leadSearch.delete({ where: { id: searchId } })

  return NextResponse.json({ ok: true })
}
