import { auth } from '@/lib/auth'
import { createGmbOAuth2Client, saveGmbTokens } from '@/lib/google-gmb'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/gmb/callback
 * Google OAuth callback for GMB. Stores tokens and redirects back to GMB page.
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.redirect(new URL('/login', req.url))

  const code = req.nextUrl.searchParams.get('code')
  const error = req.nextUrl.searchParams.get('error')

  if (error) {
    return NextResponse.redirect(new URL('/gmb?error=access_denied', req.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/gmb?error=missing_code', req.url))
  }

  try {
    const oauth2Client = createGmbOAuth2Client()
    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.access_token) {
      return NextResponse.redirect(new URL('/gmb?error=no_tokens', req.url))
    }

    await saveGmbTokens({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
    })

    return NextResponse.redirect(new URL('/gmb?connected=true', req.url))
  } catch (err) {
    console.error('GMB OAuth error:', err)
    return NextResponse.redirect(new URL('/gmb?error=oauth_failed', req.url))
  }
}
