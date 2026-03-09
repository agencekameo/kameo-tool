import { auth } from '@/lib/auth'
import { createOAuth2Client } from '@/lib/google-calendar'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.redirect(new URL('/login', req.url))

  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')

  let email: string | null = null
  let userId: string | null = null

  if (state) {
    try {
      const parsed = JSON.parse(decodeURIComponent(state))
      email = parsed.email
      userId = parsed.userId
    } catch {
      // Legacy format: state was just the email
      email = decodeURIComponent(state)
    }
  }

  if (!code || !email) {
    return NextResponse.redirect(new URL('/agenda?calendar_error=missing_code', req.url))
  }

  // Use session userId as fallback
  if (!userId) userId = session.user?.id ?? null

  try {
    const oauth2Client = createOAuth2Client()
    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(new URL('/agenda?calendar_error=no_tokens', req.url))
    }

    await prisma.googleCalendarToken.upsert({
      where: { email },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(tokens.expiry_date ?? Date.now() + 3600 * 1000),
        userId,
      },
      create: {
        email,
        userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(tokens.expiry_date ?? Date.now() + 3600 * 1000),
      },
    })

    return NextResponse.redirect(new URL('/agenda?calendar_connected=' + encodeURIComponent(email), req.url))
  } catch (err) {
    console.error('Calendar OAuth error:', err)
    return NextResponse.redirect(new URL('/agenda?calendar_error=oauth_failed', req.url))
  }
}
