import { auth } from '@/lib/auth'
import { getAuthUrl } from '@/lib/google-calendar'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'email requis' }, { status: 400 })

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json({ error: 'Google OAuth non configuré (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET manquants)' }, { status: 503 })
  }

  const url = getAuthUrl(email, session.user?.id ?? '')
  return NextResponse.redirect(url)
}
