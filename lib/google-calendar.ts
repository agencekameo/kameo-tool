import { google } from 'googleapis'
import { prisma } from './db'

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
]

export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI ?? `${(process.env.NEXTAUTH_URL || '').trim()}/api/calendar/callback`
  )
}

export function getAuthUrl(email: string, userId: string) {
  const oauth2Client = createOAuth2Client()
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GOOGLE_SCOPES,
    login_hint: email,
    state: JSON.stringify({ email, userId }),
  })
}

export async function getCalendarsForUser(userId: string) {
  const tokens = await prisma.googleCalendarToken.findMany({
    where: { userId },
    select: { email: true },
  })
  return tokens.map(t => t.email)
}

export async function getEventsForEmail(email: string, maxResults = 50) {
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
  const oneWeekLater = new Date(now)
  oneWeekLater.setDate(oneWeekLater.getDate() + 7)

  try {
    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: oneWeekLater.toISOString(),
      maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    })
    return (res.data.items ?? []).map(event => {
      // Extract video conference link (Google Meet, Teams, Zoom, etc.)
      let meetingLink: string | null = null
      let meetingType: string | null = null

      // 1. Google Meet via hangoutLink
      if (event.hangoutLink) {
        meetingLink = event.hangoutLink
        meetingType = 'Google Meet'
      }
      // 2. conferenceData (Meet, Teams, Zoom, etc.)
      if (!meetingLink && event.conferenceData?.entryPoints) {
        const videoEntry = event.conferenceData.entryPoints.find(ep => ep.entryPointType === 'video')
        if (videoEntry?.uri) {
          meetingLink = videoEntry.uri
          meetingType = event.conferenceData.conferenceSolution?.name ?? 'Visio'
        }
      }
      // 3. Fallback: check location/description for known meeting URLs
      if (!meetingLink) {
        const text = `${event.location ?? ''} ${event.description ?? ''}`
        const urlMatch = text.match(/(https:\/\/meet\.google\.com\/[a-z\-]+|https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s"<]+|https:\/\/[a-z0-9]+\.zoom\.us\/j\/[^\s"<]+)/i)
        if (urlMatch) {
          meetingLink = urlMatch[1]
          if (meetingLink.includes('meet.google.com')) meetingType = 'Google Meet'
          else if (meetingLink.includes('teams.microsoft.com')) meetingType = 'Microsoft Teams'
          else if (meetingLink.includes('zoom.us')) meetingType = 'Zoom'
          else meetingType = 'Visio'
        }
      }

      return {
        id: event.id,
        title: event.summary ?? '(Sans titre)',
        start: event.start?.dateTime ?? event.start?.date ?? '',
        end: event.end?.dateTime ?? event.end?.date ?? '',
        allDay: !event.start?.dateTime,
        location: event.location ?? null,
        description: event.description ?? null,
        calendarEmail: email,
        htmlLink: event.htmlLink ?? null,
        meetingLink,
        meetingType,
      }
    })
  } catch {
    return []
  }
}
