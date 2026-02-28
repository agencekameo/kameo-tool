import { auth } from '@/lib/auth'
import { createOAuth2Client } from '@/lib/google-calendar'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.redirect(new URL('/login', req.url))

  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const email = state ? decodeURIComponent(state) : null

  if (!code || !email) {
    return NextResponse.redirect(new URL('/?calendar_error=missing_code', req.url))
  }

  try {
    const oauth2Client = createOAuth2Client()
    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(new URL('/?calendar_error=no_tokens', req.url))
    }

    await prisma.googleCalendarToken.upsert({
      where: { email },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(tokens.expiry_date ?? Date.now() + 3600 * 1000),
      },
      create: {
        email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(tokens.expiry_date ?? Date.now() + 3600 * 1000),
      },
    })

    return NextResponse.redirect(new URL('/?calendar_connected=' + encodeURIComponent(email), req.url))
  } catch (err) {
    console.error('Calendar OAuth error:', err)
    return NextResponse.redirect(new URL('/?calendar_error=oauth_failed', req.url))
  }
}
