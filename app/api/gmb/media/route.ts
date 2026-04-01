import { auth } from '@/lib/auth'
import { getGmbMedia } from '@/lib/google-gmb'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const account = req.nextUrl.searchParams.get('account')
  const location = req.nextUrl.searchParams.get('location')
  if (!account || !location) {
    return NextResponse.json({ media: [], error: `Params manquants` })
  }

  try {
    const result = await getGmbMedia(account, location)
    return NextResponse.json({ media: result.media, error: result.error })
  } catch (err) {
    return NextResponse.json({ media: [], error: `Exception: ${err instanceof Error ? err.message : String(err)}` })
  }
}
