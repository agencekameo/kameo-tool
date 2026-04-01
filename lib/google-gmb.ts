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
  return !!tokens?.refreshToken
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
    console.log('[GMB] Token refreshed, saving new tokens')
    if (newTokens.access_token) {
      await saveGmbTokens({
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token,
        expiry_date: newTokens.expiry_date,
      })
    }
  })

  // Force refresh if token is expired or about to expire (within 5 min)
  const now = Date.now()
  const expiresAt = tokens.expiresAt ?? 0
  if (expiresAt > 0 && expiresAt - now < 5 * 60 * 1000) {
    console.log('[GMB] Token expired or expiring soon, forcing refresh')
    try {
      const { credentials } = await oauth2Client.refreshAccessToken()
      oauth2Client.setCredentials(credentials)
      await saveGmbTokens({
        access_token: credentials.access_token!,
        refresh_token: credentials.refresh_token ?? tokens.refreshToken,
        expiry_date: credentials.expiry_date,
      })
      console.log('[GMB] Token refreshed successfully')
    } catch (err) {
      console.error('[GMB] Token refresh failed:', err)
      // Don't return null — the old token might still work briefly
    }
  }

  return oauth2Client
}

async function getAccessToken(): Promise<string | null> {
  const authClient = await getAuthenticatedClient()
  if (!authClient) { console.error('[GMB] No auth client for token'); return null }
  try {
    const tokenRes = await authClient.getAccessToken()
    const token = tokenRes?.token
    if (!token) console.error('[GMB] No access token returned')
    else console.log('[GMB] Got access token (first 20 chars):', token.substring(0, 20) + '...')
    return token ?? null
  } catch (err) {
    console.error('[GMB] getAccessToken error:', err)
    return null
  }
}

// ── Google Business Profile API calls ────────────────────────────────────────

export async function getGmbAccounts() {
  const authClient = await getAuthenticatedClient()
  if (!authClient) { console.error('[GMB] No authenticated client'); return [] }

  try {
    const mybusiness = google.mybusinessaccountmanagement({
      version: 'v1',
      auth: authClient,
    })

    const res = await mybusiness.accounts.list()
    console.log('[GMB] accounts.list response:', JSON.stringify(res.data))
    return res.data.accounts ?? []
  } catch (err: unknown) {
    const e = err as { response?: { status?: number; data?: unknown }; message?: string }
    console.error('[GMB] accounts error:', e.response?.status, JSON.stringify(e.response?.data), e.message)
    throw err
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

    console.log('[GMB] Fetching locations for account:', accountId)
    const res = await mybusiness.accounts.locations.list({
      parent: accountId,
      readMask: 'name,title,storefrontAddress,websiteUri,phoneNumbers,regularHours,categories,metadata,profile',
    })
    console.log('[GMB] locations.list response:', JSON.stringify(res.data))
    return res.data.locations ?? []
  } catch (err: unknown) {
    const e = err as { response?: { status?: number; data?: unknown }; message?: string }
    console.error('[GMB] locations error:', e.response?.status, JSON.stringify(e.response?.data), e.message)
    return []
  }
}

// ── Reviews ─────────────────────────────────────────────────────────────────

export async function getGmbReviews(accountName: string, locationName: string): Promise<{ reviews: unknown[]; error?: string }> {
  const accessToken = await getAccessToken()
  if (!accessToken) return { reviews: [], error: 'Pas de token OAuth — reconnectez le compte Google' }

  const accountId = accountName.replace('accounts/', '')
  const locationId = locationName.replace('locations/', '')

  const path = `accounts/${accountId}/locations/${locationId}/reviews`
  const lastError: string[] = []

  try {
    console.log('[GMB] Fetching reviews:', path)
    const res = await fetch(
      `https://mybusiness.googleapis.com/v4/${path}?pageSize=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (res.ok) {
      const data = await res.json()
      console.log('[GMB] Reviews found:', data.reviews?.length ?? 0)
      return { reviews: data.reviews ?? [] }
    }
    const errText = await res.text()
    console.error('[GMB] Reviews failed:', res.status, errText)
    lastError.push(`API v4 ${res.status}: ${errText.substring(0, 200)}`)
  } catch (err) {
    console.error('[GMB] Reviews error:', err)
    lastError.push(String(err))
  }

  return { reviews: [], error: lastError.join(' | ') || 'Erreur inconnue' }
}

// ── Media (Photos) ──────────────────────────────────────────────────────────

export async function getGmbMedia(accountName: string, locationName: string): Promise<{ media: unknown[]; error?: string }> {
  const accessToken = await getAccessToken()
  if (!accessToken) return { media: [], error: 'Pas de token OAuth' }

  const accountId = accountName.replace('accounts/', '')
  const locationId = locationName.replace('locations/', '')

  try {
    const path = `accounts/${accountId}/locations/${locationId}/media`
    console.log('[GMB] Fetching media:', path)
    const res = await fetch(
      `https://mybusiness.googleapis.com/v4/${path}?pageSize=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!res.ok) {
      const errText = await res.text()
      console.error('[GMB] Media error:', res.status, errText)
      return { media: [], error: `API ${res.status}: ${errText.substring(0, 200)}` }
    }
    const data = await res.json()
    return { media: data.mediaItems ?? [] }
  } catch (err) {
    console.error('[GMB] Media error:', err)
    return { media: [], error: String(err) }
  }
}

// ── Local Posts ──────────────────────────────────────────────────────────────

export async function getGmbPosts(accountName: string, locationName: string): Promise<{ posts: unknown[]; error?: string }> {
  const accessToken = await getAccessToken()
  if (!accessToken) return { posts: [], error: 'Pas de token OAuth' }

  const accountId = accountName.replace('accounts/', '')
  const locationId = locationName.replace('locations/', '')

  try {
    const path = `accounts/${accountId}/locations/${locationId}/localPosts`
    console.log('[GMB] Fetching posts:', path)
    const res = await fetch(
      `https://mybusiness.googleapis.com/v4/${path}?pageSize=20`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!res.ok) {
      const errText = await res.text()
      console.error('[GMB] Posts error:', res.status, errText)
      return { posts: [], error: `API ${res.status}: ${errText.substring(0, 200)}` }
    }
    const data = await res.json()
    return { posts: data.localPosts ?? [] }
  } catch (err) {
    console.error('[GMB] Posts error:', err)
    return { posts: [], error: String(err) }
  }
}

export async function createGmbPost(accountName: string, locationName: string, post: {
  summary: string
  topicType?: string
  media?: { sourceUrl: string; mediaFormat: string }[]
}) {
  const accessToken = await getAccessToken()
  if (!accessToken) throw new Error('Not authenticated')

  const accountId = accountName.replace('accounts/', '')
  const locationId = locationName.replace('locations/', '')
  const path = `accounts/${accountId}/locations/${locationId}/localPosts`

  const body: Record<string, unknown> = {
    languageCode: 'fr',
    summary: post.summary,
    topicType: post.topicType || 'STANDARD',
  }
  if (post.media?.length) {
    body.media = post.media
  }

  const res = await fetch(`https://mybusiness.googleapis.com/v4/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error('[GMB] Create post error:', res.status, errText)
    throw new Error(`Failed to create post: ${res.status}`)
  }

  return await res.json()
}

// ── Performance metrics ─────────────────────────────────────────────────────

interface PerfDaily { date: string; impressions: number; websiteClicks: number; callClicks: number; directionRequests: number }
export async function getGmbPerformance(locationName: string): Promise<{ data: { impressions: number; callClicks: number; websiteClicks: number; directionRequests: number; daily: PerfDaily[] } | null; error?: string }> {
  const accessToken = await getAccessToken()
  if (!accessToken) return { data: null, error: 'Pas de token OAuth' }

  try {
    // Last 30 days
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 30)

    console.log('[GMB] Fetching performance for:', locationName)

    // Fetch each metric individually via GET endpoint
    const metricsToFetch = [
      'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
      'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
      'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
      'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
      'CALL_CLICKS',
      'WEBSITE_CLICKS',
      'BUSINESS_DIRECTION_REQUESTS',
    ]

    const totals: Record<string, number> = {}
    // Daily data: { "2026-03-01": { impressions: 0, websiteClicks: 0, ... } }
    const dailyMap: Record<string, Record<string, number>> = {}

    for (const metric of metricsToFetch) {
      const params = new URLSearchParams({
        dailyMetric: metric,
        'dailyRange.startDate.year': String(startDate.getFullYear()),
        'dailyRange.startDate.month': String(startDate.getMonth() + 1),
        'dailyRange.startDate.day': String(startDate.getDate()),
        'dailyRange.endDate.year': String(endDate.getFullYear()),
        'dailyRange.endDate.month': String(endDate.getMonth() + 1),
        'dailyRange.endDate.day': String(endDate.getDate()),
      })

      const url = `https://businessprofileperformance.googleapis.com/v1/${locationName}:getDailyMetricsTimeSeries?${params}`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })

      if (!res.ok) {
        const errText = await res.text()
        console.error(`[GMB] Performance metric ${metric} error:`, res.status, errText.substring(0, 100))
        if (metric === metricsToFetch[0]) {
          return { data: null, error: `API ${res.status}: ${errText.substring(0, 200)}` }
        }
        continue
      }

      const data = await res.json()
      let total = 0
      const isImpression = metric.startsWith('BUSINESS_IMPRESSIONS_')
      for (const point of data.timeSeries?.datedValues ?? []) {
        const val = parseInt(point.value || '0', 10)
        total += val
        const d = point.date
        if (d) {
          const dateKey = `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`
          if (!dailyMap[dateKey]) dailyMap[dateKey] = { impressions: 0, websiteClicks: 0, callClicks: 0, directionRequests: 0 }
          if (isImpression) dailyMap[dateKey].impressions += val
          else if (metric === 'WEBSITE_CLICKS') dailyMap[dateKey].websiteClicks += val
          else if (metric === 'CALL_CLICKS') dailyMap[dateKey].callClicks += val
          else if (metric === 'BUSINESS_DIRECTION_REQUESTS') dailyMap[dateKey].directionRequests += val
        }
      }
      totals[metric] = total
    }

    const daily: PerfDaily[] = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({ date, impressions: vals.impressions, websiteClicks: vals.websiteClicks, callClicks: vals.callClicks, directionRequests: vals.directionRequests }))

    return {
      data: {
        impressions: (totals.BUSINESS_IMPRESSIONS_DESKTOP_MAPS || 0) +
          (totals.BUSINESS_IMPRESSIONS_DESKTOP_SEARCH || 0) +
          (totals.BUSINESS_IMPRESSIONS_MOBILE_MAPS || 0) +
          (totals.BUSINESS_IMPRESSIONS_MOBILE_SEARCH || 0),
        callClicks: totals.CALL_CLICKS || 0,
        websiteClicks: totals.WEBSITE_CLICKS || 0,
        directionRequests: totals.BUSINESS_DIRECTION_REQUESTS || 0,
        daily,
      },
    }
  } catch (err) {
    console.error('[GMB] Performance error:', err)
    return { data: null, error: String(err) }
  }
}

// ── Update location ─────────────────────────────────────────────────────────

export async function updateGmbLocation(locationName: string, updates: {
  description?: string
  phone?: string
  website?: string
  address?: { addressLines: string[]; locality: string; postalCode: string; regionCode?: string }
  hours?: { openDay: string; openTime: string; closeDay: string; closeTime: string }[]
}) {
  const authClient = await getAuthenticatedClient()
  if (!authClient) throw new Error('Not authenticated')

  const mybusiness = google.mybusinessbusinessinformation({ version: 'v1', auth: authClient })

  const updateMask: string[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: Record<string, any> = {}

  if (updates.description !== undefined) {
    body.profile = { description: updates.description }
    updateMask.push('profile.description')
  }
  if (updates.phone !== undefined) {
    body.phoneNumbers = { primaryPhone: updates.phone }
    updateMask.push('phoneNumbers.primaryPhone')
  }
  if (updates.website !== undefined) {
    body.websiteUri = updates.website
    updateMask.push('websiteUri')
  }
  if (updates.address !== undefined) {
    body.storefrontAddress = {
      addressLines: updates.address.addressLines,
      locality: updates.address.locality,
      postalCode: updates.address.postalCode,
      regionCode: updates.address.regionCode || 'FR',
    }
    updateMask.push('storefrontAddress')
  }
  if (updates.hours !== undefined) {
    body.regularHours = { periods: updates.hours }
    updateMask.push('regularHours')
  }

  if (updateMask.length === 0) throw new Error('No fields to update')

  const res = await mybusiness.locations.patch({
    name: locationName,
    updateMask: updateMask.join(','),
    requestBody: body,
  })

  return res.data
}

// ── Reply to review ─────────────────────────────────────────────────────────

export async function replyToGmbReview(accountName: string, locationName: string, reviewId: string, comment: string) {
  const accessToken = await getAccessToken()
  if (!accessToken) throw new Error('Not authenticated')

  const accountId = accountName.replace('accounts/', '')
  const locationId = locationName.replace('locations/', '')
  const path = `accounts/${accountId}/locations/${locationId}/reviews/${reviewId}/reply`

  const res = await fetch(`https://mybusiness.googleapis.com/v4/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ comment }),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error('[GMB] Reply error:', res.status, errText)
    throw new Error(`Failed to reply: ${res.status}`)
  }

  return await res.json()
}

// ── Upload media ────────────────────────────────────────────────────────────

export async function uploadGmbMedia(accountName: string, locationName: string, imageUrl: string, category: string = 'ADDITIONAL') {
  const accessToken = await getAccessToken()
  if (!accessToken) throw new Error('Not authenticated')

  const accountId = accountName.replace('accounts/', '')
  const locationId = locationName.replace('locations/', '')
  const path = `accounts/${accountId}/locations/${locationId}/media`

  const res = await fetch(`https://mybusiness.googleapis.com/v4/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mediaFormat: 'PHOTO',
      locationAssociation: { category },
      sourceUrl: imageUrl,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error('[GMB] Upload media error:', res.status, errText)
    throw new Error(`Failed to upload: ${res.status}`)
  }

  return await res.json()
}
