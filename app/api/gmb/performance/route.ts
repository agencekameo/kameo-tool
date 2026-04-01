import { auth } from '@/lib/auth'
import { getGmbPerformance } from '@/lib/google-gmb'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const location = req.nextUrl.searchParams.get('location')
  if (!location) return NextResponse.json({ performance: null, error: 'location required' })

  try {
    const result = await getGmbPerformance(location)
    return NextResponse.json({ performance: result.data, error: result.error })
  } catch (err) {
    return NextResponse.json({ performance: null, error: `Exception: ${err instanceof Error ? err.message : String(err)}` })
  }
}
