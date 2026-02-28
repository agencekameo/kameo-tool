import { auth } from '@/lib/auth'
import { getCalendarsForUser, getEventsForEmail } from '@/lib/google-calendar'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userName = session.user?.name ?? ''
  const calendarEmails = getCalendarsForUser(userName)

  // Check which calendars are connected
  const tokens = await prisma.googleCalendarToken.findMany({
    where: { email: { in: calendarEmails } },
    select: { email: true },
  })
  const connectedEmails = tokens.map(t => t.email)
  const notConnected = calendarEmails.filter(e => !connectedEmails.includes(e))

  // Fetch events from all connected calendars in parallel
  const eventArrays = await Promise.all(
    connectedEmails.map(email => getEventsForEmail(email, 15))
  )

  // Merge and sort by start time
  const allEvents = eventArrays
    .flat()
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 15)

  return NextResponse.json({
    events: allEvents,
    notConnected,
    calendarEmails,
  })
}
