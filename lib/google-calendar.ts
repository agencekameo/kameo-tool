import { google } from 'googleapis'
import { prisma } from './db'

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
]

// Mapping: platform user first name (lowercase) → Google calendar emails to fetch
export const CALENDAR_MAPPING: Record<string, string[]> = {
  benjamin: ['contact@agence-kameo.fr'],
  louison: ['contact@agence-kameo.fr', 'louison.boutet@gmail.com'],
}

// Default for everyone else
export const DEFAULT_CALENDARS = ['contact@agence-kameo.fr']

export function getCalendarsForUser(userName: string): string[] {
  const firstName = userName.split(' ')[0].toLowerCase()
  return CALENDAR_MAPPING[firstName] ?? DEFAULT_CALENDARS
}

export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI ?? `${process.env.NEXTAUTH_URL}/api/calendar/callback`
  )
}

export function getAuthUrl(email: string) {
  const oauth2Client = createOAuth2Client()
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GOOGLE_SCOPES,
    login_hint: email,
    state: encodeURIComponent(email),
  })
}

export async function getEventsForEmail(email: string, maxResults = 10) {
  const token = await prisma.googleCalendarToken.findUnique({ where: { email } })
  if (!token) return []

  const oauth2Client = createOAuth2Client()
  oauth2Client.setCredentials({
    access_token: token.accessToken,
    refresh_token: token.refreshToken,
    expiry_date: token.expiresAt.getTime(),
  })

  // Auto-refresh if expired
  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.refresh_token || tokens.access_token) {
      await prisma.googleCalendarToken.update({
        where: { email },
        data: {
          accessToken: tokens.access_token ?? token.accessToken,
          refreshToken: tokens.refresh_token ?? token.refreshToken,
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : token.expiresAt,
        },
      })
    }
  })

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
  const now = new Date()
  const oneMonthLater = new Date(now)
  oneMonthLater.setMonth(oneMonthLater.getMonth() + 1)

  try {
    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: oneMonthLater.toISOString(),
      maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    })
    return (res.data.items ?? []).map(event => ({
      id: event.id,
      title: event.summary ?? '(Sans titre)',
      start: event.start?.dateTime ?? event.start?.date ?? '',
      end: event.end?.dateTime ?? event.end?.date ?? '',
      allDay: !event.start?.dateTime,
      location: event.location ?? null,
      description: event.description ?? null,
      calendarEmail: email,
      htmlLink: event.htmlLink ?? null,
    }))
  } catch {
    return []
  }
}
