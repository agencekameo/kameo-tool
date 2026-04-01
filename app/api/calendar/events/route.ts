import { auth } from '@/lib/auth'
import { getCalendarsForUser, getEventsForEmail } from '@/lib/google-calendar'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const currentUserId = session.user?.id
  if (!currentUserId) return NextResponse.json({ error: 'No user' }, { status: 401 })

  // Allow viewing other users' calendars (team visibility)
  const viewUserId = req.nextUrl.searchParams.get('userId')
  const shared = req.nextUrl.searchParams.get('shared') === 'true'
  const timeMin = req.nextUrl.searchParams.get('timeMin') || undefined
  const timeMax = req.nextUrl.searchParams.get('timeMax') || undefined
  const targetUserId = viewUserId || currentUserId

  // Return list of all users who have connected calendars
  const tokens = await prisma.googleCalendarToken.findMany({
    where: { userId: { not: null } },
    select: { userId: true, email: true, expiresAt: true },
  })
  const userIds = [...new Set(tokens.map(t => t.userId).filter(Boolean))] as string[]
  let calendarUsers: { id: string; name: string; email: string; image: string | null }[] = []
  if (userIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, avatar: true },
    })
    calendarUsers = users.map(u => ({
      id: u.id,
      name: u.name || u.email || 'Sans nom',
      email: u.email || '',
      image: u.avatar || null,
    }))
  }

  // Detect invalid tokens (expiresAt = epoch 0 means revoked)
  const invalidTokenEmails = tokens
    .filter(t => t.userId === targetUserId && t.expiresAt && new Date(t.expiresAt).getTime() === 0)
    .map(t => t.email)

  // Build email→userId mapping for shared view
  const emailToUserId: Record<string, string> = {}
  tokens.forEach(t => { if (t.userId) emailToUserId[t.email] = t.userId })

  let calendarEmails: string[]
  if (shared) {
    // Get ALL connected calendar emails
    calendarEmails = tokens.map(t => t.email)
  } else {
    calendarEmails = await getCalendarsForUser(targetUserId)
  }

  // Fetch events from all connected calendars in parallel
  const eventArrays = await Promise.all(
    calendarEmails.map(email => getEventsForEmail(email, 50, timeMin, timeMax))
  )

  // Merge, add ownerUserId, and sort by start time
  const allEvents = eventArrays
    .flat()
    .map(event => ({
      ...event,
      ownerUserId: emailToUserId[event.calendarEmail] || null,
    }))
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

  return NextResponse.json({
    events: allEvents,
    calendarEmails,
    calendarUsers,
    currentUserId,
    viewingUserId: targetUserId,
    invalidTokenEmails,
  })
}

// DELETE /api/calendar/events?email=xxx — disconnect a calendar
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'email requis' }, { status: 400 })

  const userId = session.user?.id
  const role = (session.user as { role?: string })?.role
  const token = await prisma.googleCalendarToken.findUnique({ where: { email } })

  if (!token) return NextResponse.json({ error: 'Calendrier non trouvé' }, { status: 404 })
  if (token.userId !== userId && role !== 'ADMIN') {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  await prisma.googleCalendarToken.delete({ where: { email } })
  return NextResponse.json({ success: true })
}
