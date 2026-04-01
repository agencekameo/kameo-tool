import { auth } from '@/lib/auth'
import { getGmbReviews } from '@/lib/google-gmb'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const account = req.nextUrl.searchParams.get('account')
  const location = req.nextUrl.searchParams.get('location')
  if (!account || !location) {
    return NextResponse.json({ reviews: [], error: `Params manquants: account=${account}, location=${location}` })
  }

  try {
    const result = await getGmbReviews(account, location)
    return NextResponse.json({ reviews: result.reviews, error: result.error })
  } catch (err) {
    return NextResponse.json({ reviews: [], error: `Exception: ${err instanceof Error ? err.message : String(err)}` })
  }
}
