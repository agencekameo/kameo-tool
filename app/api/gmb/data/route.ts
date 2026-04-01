import { auth } from '@/lib/auth'
import { isGmbConnected, getGmbAccounts, getGmbLocations, disconnectGmb } from '@/lib/google-gmb'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/gmb/data
 * Returns the connection status, accounts, and locations for GMB.
 */
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const connected = await isGmbConnected()
  if (!connected) {
    return NextResponse.json({ connected: false, accounts: [], locations: [] })
  }

  try {
    const accounts = await getGmbAccounts()

    // Get locations for each account
    const allLocations: unknown[] = []
    for (const account of accounts) {
      if (account.name) {
        const locations = await getGmbLocations(account.name)
        allLocations.push(...locations.map(loc => ({
          ...loc,
          accountName: account.name,
          accountDisplayName: account.accountName,
        })))
      }
    }

    return NextResponse.json({
      connected: true,
      accounts: accounts.map(a => ({
        name: a.name,
        accountName: a.accountName,
        type: a.type,
      })),
      locations: allLocations,
    })
  } catch (err: unknown) {
    const e = err as { response?: { status?: number; data?: unknown }; message?: string }
    console.error('GMB data error:', e.response?.status, JSON.stringify(e.response?.data), e.message)
    return NextResponse.json({
      connected: true,
      accounts: [],
      locations: [],
      error: `API Error: ${e.response?.status || 'unknown'} — ${e.message || 'unknown'}`,
      debug: e.response?.data ?? null,
    })
  }
}

/**
 * DELETE /api/gmb/data
 * Disconnects the GMB account.
 */
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string })?.role
  if (role !== 'ADMIN') {
    return NextResponse.json({ error: 'Réservé aux administrateurs.' }, { status: 403 })
  }

  await disconnectGmb()
  return NextResponse.json({ success: true })
}
