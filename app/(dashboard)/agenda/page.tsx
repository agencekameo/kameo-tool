'use client'

import { useEffect, useState, useMemo } from 'react'
import { Calendar, MapPin, Clock, ExternalLink, RefreshCw, Plus, X, ChevronLeft, ChevronRight, Mail, Trash2, Users, Video } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CalendarEvent {
  id: string | null
  title: string
  start: string
  end: string
  allDay: boolean
  location: string | null
  description: string | null
  calendarEmail: string
  htmlLink: string | null
  meetingLink?: string | null
  meetingType?: string | null
  ownerUserId?: string | null
}

interface CalendarUser {
  id: string
  name: string
  email: string
  image: string | null
}

interface CalendarData {
  events: CalendarEvent[]
  calendarEmails: string[]
  calendarUsers: CalendarUser[]
  currentUserId: string
  viewingUserId: string
}

type ViewMode = 'user' | 'shared'

const USER_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {}
const COLOR_PALETTE = [
  { bg: 'bg-[#E14B89]/20', border: 'border-[#E14B89]/40', text: 'text-[#E14B89]', dot: 'bg-[#E14B89]' },
  { bg: 'bg-blue-500/20', border: 'border-blue-500/40', text: 'text-blue-400', dot: 'bg-blue-500' },
  { bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  { bg: 'bg-amber-500/20', border: 'border-amber-500/40', text: 'text-amber-400', dot: 'bg-amber-500' },
  { bg: 'bg-purple-500/20', border: 'border-purple-500/40', text: 'text-purple-400', dot: 'bg-purple-500' },
]
const SHARED_COLOR = { bg: 'bg-violet-500/20', border: 'border-violet-500/40', text: 'text-violet-400', dot: 'bg-violet-500' }

function getUserColor(userId: string, allUserIds: string[]) {
  const idx = allUserIds.indexOf(userId)
  return COLOR_PALETTE[idx % COLOR_PALETTE.length]
}

const CALENDAR_COLORS = [
  'bg-[#E14B89]', 'bg-purple-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-cyan-500', 'bg-rose-500', 'bg-indigo-500',
]

function getCalendarColor(email: string, allEmails: string[]) {
  const idx = allEmails.indexOf(email)
  return CALENDAR_COLORS[idx % CALENDAR_COLORS.length]
}

function formatTime(date: string) {
  return new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate()
}

function getDayLabel(date: Date) {
  const now = new Date()
  const tomorrow = new Date(now.getTime() + 86400000)
  if (isSameDay(date, now)) return "Aujourd'hui"
  if (isSameDay(date, tomorrow)) return 'Demain'
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1
}

// Get the Monday of the current week
function getWeekStart(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })
}

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7) // 7h to 21h

export default function AgendaPage() {
  const [data, setData] = useState<CalendarData | null>(null)
  const [sharedData, setSharedData] = useState<CalendarData | null>(null)
  const [loading, setLoading] = useState(true)
  const [sharedLoading, setSharedLoading] = useState(false)
  const [error, setError] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [viewingUser, setViewingUser] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('user')
  const [weekOffset, setWeekOffset] = useState(0)

  const now = new Date()
  const [calMonth, setCalMonth] = useState(now.getMonth())
  const [calYear, setCalYear] = useState(now.getFullYear())

  function fetchEvents(userId?: string | null) {
    setLoading(true)
    setError('')
    const url = userId ? `/api/calendar/events?userId=${userId}` : '/api/calendar/events'
    fetch(url)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d) })
      .catch(() => setError('Erreur de chargement'))
      .finally(() => setLoading(false))
  }

  function fetchSharedEvents() {
    setSharedLoading(true)
    fetch('/api/calendar/events?shared=true')
      .then(r => r.json())
      .then(d => { if (!d.error) setSharedData(d) })
      .catch(() => {})
      .finally(() => setSharedLoading(false))
  }

  useEffect(() => { fetchEvents() }, [])

  useEffect(() => {
    if (viewMode === 'shared' && !sharedData) {
      fetchSharedEvents()
    }
  }, [viewMode])

  function handleSwitchUser(userId: string | null) {
    setViewingUser(userId)
    setViewMode('user')
    fetchEvents(userId)
  }

  function handleConnect() {
    const email = newEmail.trim()
    if (!email || !email.includes('@')) return
    window.location.href = `/api/calendar/connect?email=${encodeURIComponent(email)}`
  }

  async function handleDisconnect(email: string) {
    if (!confirm(`Déconnecter le calendrier ${email} ?`)) return
    setDisconnecting(email)
    try {
      const res = await fetch(`/api/calendar/events?email=${encodeURIComponent(email)}`, { method: 'DELETE' })
      if (res.ok) {
        fetchEvents()
      } else {
        const d = await res.json()
        alert(d.error || 'Erreur')
      }
    } catch {
      alert('Erreur réseau')
    } finally {
      setDisconnecting(null)
    }
  }

  // Group events by day for list view
  const eventsByDay: Record<string, CalendarEvent[]> = {}
  if (data) {
    data.events.forEach(event => {
      const dayKey = new Date(event.start).toDateString()
      if (!eventsByDay[dayKey]) eventsByDay[dayKey] = []
      eventsByDay[dayKey].push(event)
    })
  }
  const dayKeys = Object.keys(eventsByDay).sort((a, b) => new Date(a).getTime() - new Date(b).getTime())

  // Mini calendar data
  const daysInMonth = getDaysInMonth(calYear, calMonth)
  const firstDay = getFirstDayOfMonth(calYear, calMonth)
  const monthLabel = new Date(calYear, calMonth).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  const activeData = viewMode === 'shared' ? sharedData : data
  const eventDays = new Set<string>()
  if (activeData) {
    activeData.events.forEach(e => {
      const d = new Date(e.start)
      if (d.getMonth() === calMonth && d.getFullYear() === calYear) {
        eventDays.add(d.getDate().toString())
      }
    })
  }

  function prevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) }
    else setCalMonth(m => m - 1)
  }
  function nextMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) }
    else setCalMonth(m => m + 1)
  }

  const allEmails = data?.calendarEmails ?? []
  const allUserIds = (data?.calendarUsers ?? []).map(u => u.id)

  // --- Shared week view logic ---
  const weekStart = useMemo(() => {
    const base = getWeekStart(now)
    base.setDate(base.getDate() + weekOffset * 7)
    return base
  }, [weekOffset])
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart])

  // Detect shared events (same title + overlapping time from different users)
  const sharedEvents = useMemo(() => {
    if (!sharedData) return new Set<string>()
    const shared = new Set<string>()
    const events = sharedData.events
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const a = events[i], b = events[j]
        if (
          a.title === b.title &&
          a.ownerUserId !== b.ownerUserId &&
          a.start === b.start &&
          a.end === b.end
        ) {
          shared.add(`${a.id}-${a.calendarEmail}`)
          shared.add(`${b.id}-${b.calendarEmail}`)
        }
      }
    }
    return shared
  }, [sharedData])

  // Deduplicate shared events (keep one representative)
  const deduplicatedEvents = useMemo(() => {
    if (!sharedData) return []
    const seen = new Map<string, CalendarEvent>()
    const result: (CalendarEvent & { isShared: boolean })[] = []
    for (const event of sharedData.events) {
      const key = `${event.title}|${event.start}|${event.end}`
      const eventKey = `${event.id}-${event.calendarEmail}`
      const isShared = sharedEvents.has(eventKey)
      if (isShared) {
        if (!seen.has(key)) {
          seen.set(key, event)
          result.push({ ...event, isShared: true })
        }
      } else {
        result.push({ ...event, isShared: false })
      }
    }
    return result
  }, [sharedData, sharedEvents])

  // Group deduplicated events by day for the week view
  const weekEventsByDay = useMemo(() => {
    const map: Record<string, (CalendarEvent & { isShared: boolean })[]> = {}
    weekDays.forEach(d => { map[d.toDateString()] = [] })
    deduplicatedEvents.forEach(event => {
      const dayKey = new Date(event.start).toDateString()
      if (map[dayKey]) map[dayKey].push(event)
    })
    return map
  }, [deduplicatedEvents, weekDays])

  // Position events within a day column (handle overlaps)
  function layoutEvents(events: (CalendarEvent & { isShared: boolean })[]) {
    // Only layout timed events
    const timed = events.filter(e => !e.allDay).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    const allDay = events.filter(e => e.allDay)

    // Detect overlapping groups
    const positioned: { event: CalendarEvent & { isShared: boolean }; col: number; totalCols: number }[] = []
    const groups: (CalendarEvent & { isShared: boolean })[][] = []
    let currentGroup: (CalendarEvent & { isShared: boolean })[] = []
    let groupEnd = 0

    for (const event of timed) {
      const start = new Date(event.start).getTime()
      const end = new Date(event.end).getTime()
      if (currentGroup.length === 0 || start < groupEnd) {
        currentGroup.push(event)
        groupEnd = Math.max(groupEnd, end)
      } else {
        groups.push([...currentGroup])
        currentGroup = [event]
        groupEnd = end
      }
    }
    if (currentGroup.length > 0) groups.push(currentGroup)

    for (const group of groups) {
      const totalCols = group.length
      group.forEach((event, col) => {
        positioned.push({ event, col, totalCols })
      })
    }

    return { positioned, allDay }
  }

  function getEventTop(start: string) {
    const d = new Date(start)
    const hours = d.getHours() + d.getMinutes() / 60
    return ((hours - 7) / 15) * 100 // 7h start, 15h range (7-22)
  }

  function getEventHeight(start: string, end: string) {
    const s = new Date(start)
    const e = new Date(end)
    const durationHours = (e.getTime() - s.getTime()) / (1000 * 60 * 60)
    return Math.max((durationHours / 15) * 100, 1.5) // minimum height
  }

  function getEventColor(event: CalendarEvent & { isShared: boolean }) {
    if (event.isShared) return SHARED_COLOR
    if (event.ownerUserId) return getUserColor(event.ownerUserId, allUserIds)
    return COLOR_PALETTE[0]
  }

  const weekLabel = useMemo(() => {
    const start = weekDays[0]
    const end = weekDays[6]
    const sameMonth = start.getMonth() === end.getMonth()
    if (sameMonth) {
      return `${start.getDate()} - ${end.getDate()} ${start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`
    }
    return `${start.getDate()} ${start.toLocaleDateString('fr-FR', { month: 'short' })} - ${end.getDate()} ${end.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}`
  }, [weekDays])

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Agenda</h1>
          <p className="text-slate-400 text-sm mt-1">
            {activeData ? `${activeData.events.length} rendez-vous cette semaine` : 'Chargement...'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {viewMode === 'user' && !viewingUser && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-[#E14B89] hover:bg-[#E14B89]/80 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              <Plus size={14} />
              Ajouter un calendrier
            </button>
          )}
          <button
            onClick={() => {
              if (viewMode === 'shared') fetchSharedEvents()
              else fetchEvents(viewingUser)
            }}
            className="flex items-center gap-2 bg-[#111118] border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            <RefreshCw size={14} className={(loading || sharedLoading) ? 'animate-spin' : ''} />
            Rafraichir
          </button>
        </div>
      </div>

      {/* View switcher: user tabs + shared */}
      {data && data.calendarUsers && data.calendarUsers.length > 0 && (
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {data.calendarUsers.map(user => {
            const isActive = viewMode === 'user' && ((viewingUser === null && user.id === data.currentUserId) || viewingUser === user.id)
            const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
            return (
              <button
                key={user.id}
                onClick={() => handleSwitchUser(user.id === data.currentUserId ? null : user.id)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all',
                  isActive
                    ? 'bg-[#E14B89]/15 border border-[#E14B89]/30 text-white'
                    : 'bg-[#111118] border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                )}
              >
                {user.image ? (
                  <img src={user.image} alt="" className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[9px] text-slate-300 font-bold">
                    {initials}
                  </div>
                )}
                {user.name.split(' ')[0]}
              </button>
            )
          })}
          {data.calendarUsers.length > 1 && (
            <button
              onClick={() => {
                setViewMode('shared')
                setViewingUser(null)
              }}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all',
                viewMode === 'shared'
                  ? 'bg-violet-500/15 border border-violet-500/30 text-white'
                  : 'bg-[#111118] border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              )}
            >
              <Users size={14} />
              Agenda mutualisé
            </button>
          )}
        </div>
      )}

      {/* Add calendar modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-[#0A0A12] border border-slate-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold">Connecter un Google Calendar</h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-500 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <p className="text-slate-400 text-sm mb-4">
              Entrez l&apos;adresse Gmail ou Google Workspace du calendrier que vous souhaitez connecter.
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleConnect()}
                  placeholder="exemple@gmail.com"
                  className="w-full bg-[#111118] border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#E14B89]/50"
                  autoFocus
                />
              </div>
              <button
                onClick={handleConnect}
                disabled={!newEmail.trim() || !newEmail.includes('@')}
                className="bg-[#E14B89] hover:bg-[#E14B89]/80 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap"
              >
                Connecter
              </button>
            </div>
            <p className="text-slate-600 text-xs mt-3">
              Vous serez redirige vers Google pour autoriser l&apos;acces en lecture seule a votre calendrier.
            </p>
          </div>
        </div>
      )}

      {/* ========== SHARED WEEKLY VIEW ========== */}
      {viewMode === 'shared' && (
        <div className="space-y-4">
          {/* Week navigation */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setWeekOffset(o => o - 1)} className="text-slate-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800">
                <ChevronLeft size={16} />
              </button>
              <h3 className="text-white text-sm font-semibold capitalize min-w-[220px] text-center">{weekLabel}</h3>
              <button onClick={() => setWeekOffset(o => o + 1)} className="text-slate-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800">
                <ChevronRight size={16} />
              </button>
              {weekOffset !== 0 && (
                <button
                  onClick={() => setWeekOffset(0)}
                  className="text-xs text-slate-500 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  Aujourd&apos;hui
                </button>
              )}
            </div>
            {/* Color legend */}
            <div className="flex items-center gap-4">
              {(data?.calendarUsers ?? []).map(user => {
                const color = getUserColor(user.id, allUserIds)
                return (
                  <div key={user.id} className="flex items-center gap-1.5">
                    <div className={cn('w-2.5 h-2.5 rounded-full', color.dot)} />
                    <span className="text-slate-400 text-xs">{user.name.split(' ')[0]}</span>
                  </div>
                )
              })}
              <div className="flex items-center gap-1.5">
                <div className={cn('w-2.5 h-2.5 rounded-full', SHARED_COLOR.dot)} />
                <span className="text-slate-400 text-xs">Commun</span>
              </div>
            </div>
          </div>

          {sharedLoading && (
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-12 text-center">
              <RefreshCw size={20} className="text-slate-600 mx-auto animate-spin mb-2" />
              <p className="text-slate-500 text-sm">Chargement...</p>
            </div>
          )}

          {!sharedLoading && sharedData && (
            <div className="bg-[#111118] border border-slate-800 rounded-2xl overflow-hidden">
              {/* Day headers */}
              <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-slate-800">
                <div className="p-2" />
                {weekDays.map((day, i) => {
                  const isToday = isSameDay(day, now)
                  const dayName = day.toLocaleDateString('fr-FR', { weekday: 'short' })
                  const dayNum = day.getDate()
                  return (
                    <div key={i} className={cn('p-2 text-center border-l border-slate-800', isToday && 'bg-[#E14B89]/5')}>
                      <div className="text-slate-500 text-[10px] uppercase font-medium">{dayName}</div>
                      <div className={cn(
                        'text-lg font-semibold mt-0.5',
                        isToday ? 'text-[#E14B89]' : 'text-white'
                      )}>
                        {dayNum}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* All-day events row */}
              {weekDays.some(day => weekEventsByDay[day.toDateString()]?.some(e => e.allDay)) && (
                <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-slate-800">
                  <div className="p-1 flex items-center justify-center">
                    <span className="text-slate-600 text-[9px]">Journée</span>
                  </div>
                  {weekDays.map((day, i) => {
                    const dayEvents = weekEventsByDay[day.toDateString()]?.filter(e => e.allDay) ?? []
                    const isToday = isSameDay(day, now)
                    return (
                      <div key={i} className={cn('p-1 border-l border-slate-800 space-y-0.5', isToday && 'bg-[#E14B89]/5')}>
                        {dayEvents.map((event, j) => {
                          const color = getEventColor(event)
                          return (
                            <div
                              key={j}
                              className={cn('text-[10px] px-1.5 py-0.5 rounded truncate border', color.bg, color.border, color.text)}
                              title={event.title}
                            >
                              {event.title}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Time grid */}
              <div className="grid grid-cols-[60px_repeat(7,1fr)] relative" style={{ height: `${HOURS.length * 56}px` }}>
                {/* Hour labels */}
                <div className="relative">
                  {HOURS.map(hour => (
                    <div
                      key={hour}
                      className="absolute w-full text-right pr-2 -mt-2"
                      style={{ top: `${((hour - 7) / 15) * 100}%` }}
                    >
                      <span className="text-slate-600 text-[10px]">{`${hour}:00`}</span>
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                {weekDays.map((day, dayIdx) => {
                  const dayKey = day.toDateString()
                  const dayEvents = weekEventsByDay[dayKey] ?? []
                  const { positioned } = layoutEvents(dayEvents)
                  const isToday = isSameDay(day, now)

                  return (
                    <div key={dayIdx} className={cn('relative border-l border-slate-800', isToday && 'bg-[#E14B89]/5')}>
                      {/* Hour grid lines */}
                      {HOURS.map(hour => (
                        <div
                          key={hour}
                          className="absolute w-full border-t border-slate-800/50"
                          style={{ top: `${((hour - 7) / 15) * 100}%` }}
                        />
                      ))}

                      {/* Current time indicator */}
                      {isToday && (
                        <div
                          className="absolute w-full z-20 flex items-center"
                          style={{ top: `${((now.getHours() + now.getMinutes() / 60 - 7) / 15) * 100}%` }}
                        >
                          <div className="w-2 h-2 rounded-full bg-[#E14B89] -ml-1" />
                          <div className="flex-1 h-[2px] bg-[#E14B89]" />
                        </div>
                      )}

                      {/* Events */}
                      {positioned.map(({ event, col, totalCols }, idx) => {
                        const top = getEventTop(event.start)
                        const height = getEventHeight(event.start, event.end)
                        const color = getEventColor(event)
                        const width = 100 / totalCols
                        const left = col * width

                        return (
                          <div
                            key={idx}
                            className={cn(
                              'absolute rounded-lg border px-1.5 py-1 overflow-hidden cursor-pointer z-10 hover:z-30 transition-shadow hover:shadow-lg hover:shadow-black/30',
                              color.bg, color.border
                            )}
                            style={{
                              top: `${top}%`,
                              height: `${height}%`,
                              left: `calc(${left}% + 2px)`,
                              width: `calc(${width}% - 4px)`,
                              minHeight: '22px',
                            }}
                            title={`${event.title}\n${formatTime(event.start)} - ${formatTime(event.end)}${event.meetingType ? `\n${event.meetingType}` : ''}${event.location ? `\n${event.location}` : ''}`}
                            onClick={() => {
                              if (event.meetingLink) window.open(event.meetingLink, '_blank')
                              else if (event.htmlLink) window.open(event.htmlLink, '_blank')
                            }}
                          >
                            <div className={cn('text-[10px] font-medium truncate leading-tight', color.text)}>
                              {event.title}
                            </div>
                            <div className="text-[9px] text-slate-400 truncate">
                              {formatTime(event.start)} - {formatTime(event.end)}
                            </div>
                            {event.meetingLink && (
                              <div className="text-[9px] text-blue-400 truncate flex items-center gap-0.5">
                                <Video size={8} className="flex-shrink-0" />
                                {event.meetingType || 'Visio'}
                              </div>
                            )}
                            {event.isShared && !event.meetingLink && (
                              <div className="text-[8px] text-violet-400/70 truncate">
                                <Users size={8} className="inline mr-0.5" />
                                Commun
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========== USER LIST VIEW ========== */}
      {viewMode === 'user' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Events list */}
          <div className="lg:col-span-2 space-y-6">
            {loading && (
              <div className="space-y-4 animate-pulse">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
                    <div className="h-4 bg-slate-800 rounded-full w-32 mb-3" />
                    <div className="h-3 bg-slate-800 rounded-full w-48" />
                  </div>
                ))}
              </div>
            )}

            {error && !loading && (
              <div className="bg-[#111118] border border-slate-800 rounded-2xl p-8 text-center">
                <p className="text-slate-500">{error}</p>
              </div>
            )}

            {!loading && !error && data && data.events.length === 0 && (
              <div className="bg-[#111118] border border-slate-800 rounded-2xl p-12 text-center">
                <Calendar size={32} className="text-slate-700 mx-auto mb-3" />
                {allEmails.length === 0 ? (
                  <>
                    <p className="text-slate-500">Aucun calendrier connecte</p>
                    <p className="text-slate-600 text-sm mt-1">Ajoutez un Google Calendar pour voir vos rendez-vous</p>
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="mt-4 flex items-center gap-2 bg-[#E14B89] hover:bg-[#E14B89]/80 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors mx-auto"
                    >
                      <Plus size={14} />
                      Ajouter un calendrier
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-slate-500">Aucun rendez-vous a venir</p>
                    <p className="text-slate-600 text-sm mt-1">Les prochains rendez-vous apparaitront ici</p>
                  </>
                )}
              </div>
            )}

            {!loading && !error && dayKeys.map(dayKey => {
              const dayDate = new Date(dayKey)
              const events = eventsByDay[dayKey]
              const isToday = isSameDay(dayDate, now)

              return (
                <div key={dayKey}>
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className={cn('text-sm font-semibold capitalize', isToday ? 'text-[#E14B89]' : 'text-white')}>
                      {getDayLabel(dayDate)}
                    </h3>
                    {isToday && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E14B89]/15 text-[#E14B89] border border-[#E14B89]/20 font-medium">
                        Aujourd&apos;hui
                      </span>
                    )}
                    <div className="flex-1 h-px bg-slate-800" />
                    <span className="text-slate-600 text-xs">{events.length} rdv</span>
                  </div>

                  <div className="space-y-2">
                    {events.map((event, i) => {
                      const calColor = getCalendarColor(event.calendarEmail, allEmails)
                      return (
                        <div
                          key={`${event.id}-${i}`}
                          className="bg-[#111118] border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition-colors group"
                        >
                          <div className="flex items-start gap-3">
                            <div className={cn('w-1 rounded-full self-stretch min-h-[40px]', calColor)} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-3">
                                <h4 className="text-white text-sm font-medium">{event.title}</h4>
                                {event.htmlLink && (
                                  <a
                                    href={event.htmlLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-slate-600 hover:text-[#E14B89] opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                                  >
                                    <ExternalLink size={13} />
                                  </a>
                                )}
                              </div>
                              <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                                <span className="flex items-center gap-1.5 text-slate-400 text-xs">
                                  <Clock size={11} />
                                  {event.allDay ? 'Toute la journee' : `${formatTime(event.start)} - ${formatTime(event.end)}`}
                                </span>
                                {event.meetingLink && (
                                  <a
                                    href={event.meetingLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-2 py-0.5 rounded-lg transition-colors"
                                  >
                                    <Video size={11} />
                                    {event.meetingType || 'Rejoindre'}
                                  </a>
                                )}
                                {event.location && (
                                  <span className="flex items-center gap-1.5 text-slate-500 text-xs truncate max-w-[250px]">
                                    <MapPin size={11} />
                                    {event.location}
                                  </span>
                                )}
                                {allEmails.length > 1 && (
                                  <span className="flex items-center gap-1.5 text-slate-600 text-xs">
                                    <div className={cn('w-1.5 h-1.5 rounded-full', calColor)} />
                                    {event.calendarEmail}
                                  </span>
                                )}
                              </div>
                              {event.description && (
                                <p className="text-slate-600 text-xs mt-2 line-clamp-2">{event.description}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Mini calendar */}
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <button onClick={prevMonth} className="text-slate-500 hover:text-white transition-colors p-1">
                  <ChevronLeft size={16} />
                </button>
                <h3 className="text-white text-sm font-semibold capitalize">{monthLabel}</h3>
                <button onClick={nextMonth} className="text-slate-500 hover:text-white transition-colors p-1">
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center">
                {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                  <div key={i} className="text-slate-600 text-[10px] font-medium py-1">{d}</div>
                ))}
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const isNow = isSameDay(new Date(calYear, calMonth, day), now)
                  const hasEvent = eventDays.has(day.toString())
                  return (
                    <div
                      key={day}
                      className={cn(
                        'text-xs py-1.5 rounded-lg relative',
                        isNow ? 'bg-[#E14B89] text-white font-bold' :
                        hasEvent ? 'text-white font-medium' :
                        'text-slate-500'
                      )}
                    >
                      {day}
                      {hasEvent && !isNow && (
                        <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#E14B89]" />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Stats */}
            {data && data.events.length > 0 && (
              <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
                <h3 className="text-white text-sm font-semibold mb-3">Resume</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-xs">Total rendez-vous</span>
                    <span className="text-white text-sm font-medium">{data.events.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-xs">Aujourd&apos;hui</span>
                    <span className="text-[#E14B89] text-sm font-medium">
                      {data.events.filter(e => isSameDay(new Date(e.start), now)).length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-xs">Cette semaine</span>
                    <span className="text-white text-sm font-medium">
                      {data.events.filter(e => {
                        const d = new Date(e.start)
                        const startOfWeek = new Date(now)
                        startOfWeek.setDate(now.getDate() - now.getDay() + 1)
                        startOfWeek.setHours(0, 0, 0, 0)
                        const endOfWeek = new Date(startOfWeek)
                        endOfWeek.setDate(startOfWeek.getDate() + 7)
                        return d >= startOfWeek && d < endOfWeek
                      }).length}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Connected calendars */}
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white text-sm font-semibold">Calendriers connectes</h3>
                {!viewingUser && (
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="text-slate-500 hover:text-[#E14B89] transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>
              {allEmails.length === 0 ? (
                <p className="text-slate-600 text-xs">Aucun calendrier connecte</p>
              ) : (
                <div className="space-y-2">
                  {allEmails.map(email => (
                    <div key={email} className="flex items-center gap-2 group">
                      <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', getCalendarColor(email, allEmails))} />
                      <span className="text-slate-300 text-xs truncate flex-1">{email}</span>
                      {!viewingUser && (
                        <button
                          onClick={() => handleDisconnect(email)}
                          disabled={disconnecting === email}
                          className="text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
