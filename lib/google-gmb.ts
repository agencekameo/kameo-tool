import { google } from 'googleapis'
import { prisma } from './db'

/**
 * Google Business Profile (GMB) helpers.
 * Uses the same GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET as Calendar,
 * but with a different redirect URI and scope.
 */

const GMB_SCOPES = [
  'https://www.googleapis.com/auth/business.manage',
]

const GMB_SETTINGS_PREFIX = 'gmb:'

// ── OAuth helpers ────────────────────────────────────────────────────────────

export function createGmbOAuth2Client() {
  const baseUrl = (process.env.NEXTAUTH_URL || 'http://localhost:3000').trim()
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${baseUrl}/api/gmb/callback`
  )
}

export function getGmbAuthUrl() {
  const oauth2Client = createGmbOAuth2Client()
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GMB_SCOPES,
  })
}

// ── Token storage (in Settings table) ────────────────────────────────────────

async function getGmbSetting(key: string): Promise<string | null> {
  const setting = await prisma.setting.findUnique({
    where: { key: `${GMB_SETTINGS_PREFIX}${key}` },
  })
  return setting?.value ?? null
}

async function setGmbSetting(key: string, value: string) {
  await prisma.setting.upsert({
    where: { key: `${GMB_SETTINGS_PREFIX}${key}` },
    update: { value },
    create: { key: `${GMB_SETTINGS_PREFIX}${key}`, value },
  })
}

export async function saveGmbTokens(tokens: {
  access_token: string
  refresh_token?: string | null
  expiry_date?: number | null
}) {
  await setGmbSetting('accessToken', tokens.access_token)
  if (tokens.refresh_token) {
    await setGmbSetting('refreshToken', tokens.refresh_token)
  }
  if (tokens.expiry_date) {
    await setGmbSetting('expiresAt', tokens.expiry_date.toString())
  }
}

export async function getGmbTokens() {
  const accessToken = await getGmbSetting('accessToken')
  const refreshToken = await getGmbSetting('refreshToken')
  const expiresAt = await getGmbSetting('expiresAt')

  if (!accessToken || !refreshToken) return null

  return {
    accessToken,
    refreshToken,
    expiresAt: expiresAt ? parseInt(expiresAt, 10) : null,
  }
}

export async function isGmbConnected(): Promise<boolean> {
  const tokens = await getGmbTokens()
  return !!tokens
}

export async function disconnectGmb() {
  const keys = ['accessToken', 'refreshToken', 'expiresAt', 'accountId']
  for (const key of keys) {
    try {
      await prisma.setting.delete({
        where: { key: `${GMB_SETTINGS_PREFIX}${key}` },
      })
    } catch {
      // Key might not exist
    }
  }
}

// ── Authenticated OAuth client ───────────────────────────────────────────────

async function getAuthenticatedClient() {
  const tokens = await getGmbTokens()
  if (!tokens) return null

  const oauth2Client = createGmbOAuth2Client()
  oauth2Client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expiry_date: tokens.expiresAt ?? undefined,
  })

  // Auto-refresh if expired
  oauth2Client.on('tokens', async (newTokens) => {
    if (newTokens.access_token) {
      await saveGmbTokens({
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token,
        expiry_date: newTokens.expiry_date,
      })
    }
  })

  return oauth2Client
}

// ── Google Business Profile API calls ────────────────────────────────────────

export async function getGmbAccounts() {
  const authClient = await getAuthenticatedClient()
  if (!authClient) return []

  try {
    const mybusiness = google.mybusinessaccountmanagement({
      version: 'v1',
      auth: authClient,
    })

    const res = await mybusiness.accounts.list()
    return res.data.accounts ?? []
  } catch (err) {
    console.error('GMB accounts error:', err)
    return []
  }
}

export async function getGmbLocations(accountId: string) {
  const authClient = await getAuthenticatedClient()
  if (!authClient) return []

  try {
    const mybusiness = google.mybusinessbusinessinformation({
      version: 'v1',
      auth: authClient,
    })

    const res = await mybusiness.accounts.locations.list({
      parent: accountId,
      readMask: 'name,title,storefrontAddress,websiteUri,phoneNumbers,regularHours,categories,metadata',
    })
    return res.data.locations ?? []
  } catch (err) {
    console.error('GMB locations error:', err)
    return []
  }
}

export async function getGmbReviews(locationName: string) {
  const authClient = await getAuthenticatedClient()
  if (!authClient) return []

  try {
    const mybusiness = google.mybusinessaccountmanagement({
      version: 'v1',
      auth: authClient,
    })

    // Use the Account Management API to list reviews
    const res = await (mybusiness as unknown as { accounts: { locations: { reviews: { list: (opts: { parent: string; pageSize: number }) => Promise<{ data: { reviews?: unknown[] } }> } } } }).accounts.locations.reviews.list({
      parent: locationName,
      pageSize: 50,
    })
    return res.data.reviews ?? []
  } catch (err) {
    console.error('GMB reviews error:', err)
    return []
  }
}
