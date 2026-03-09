import { auth } from '@/lib/auth'
import { getGmbAuthUrl } from '@/lib/google-gmb'
import { NextResponse } from 'next/server'

/**
 * GET /api/gmb/connect
 * Redirects to Google OAuth for Business Profile (GMB) access.
 */
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json(
      { error: 'Google OAuth non configuré (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET manquants)' },
      { status: 503 }
    )
  }

  const url = getGmbAuthUrl()
  return NextResponse.redirect(url)
}
