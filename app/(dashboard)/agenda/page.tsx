'use client'

import { useEffect, useState } from 'react'
import { Calendar, MapPin, Clock, ExternalLink, AlertCircle, RefreshCw, Link2, ChevronLeft, ChevronRight } from 'lucide-react'
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
}

interface CalendarData {
  events: CalendarEvent[]
  notConnected: string[]
  calendarEmails: string[]
}

function getCalendarColor(email: string) {
  if (email.includes('louison')) return 'bg-purple-500'
  return 'bg-[#E14B89]'
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
  return day === 0 ? 6 : day - 1 // Monday = 0
}

export default function AgendaPage() {
  const [data, setData] = useState<CalendarData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const now = new Date()
  const [calMonth, setCalMonth] = useState(now.getMonth())
  const [calYear, setCalYear] = useState(now.getFullYear())

  function fetchEvents() {
    setLoading(true)
    setError('')
    fetch('/api/calendar/events')
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d) })
      .catch(() => setError('Erreur de chargement'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchEvents() }, [])

  // Group events by day
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

  // Days with events for highlighting
  const eventDays = new Set<string>()
  if (data) {
    data.events.forEach(e => {
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

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Agenda</h1>
          <p className="text-slate-400 text-sm mt-1">
            {data ? `${data.events.length} rendez-vous a venir` : 'Chargement...'}
          </p>
        </div>
        <button
          onClick={fetchEvents}
          className="flex items-center gap-2 bg-[#111118] border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Rafraichir
        </button>
      </div>

      {/* Not connected banners */}
      {data?.notConnected && data.notConnected.length > 0 && (
        <div className="space-y-2 mb-6">
          {data.notConnected.map(email => (
            <div key={email} className="flex items-center justify-between gap-2 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <div className="flex items-center gap-2">
                <AlertCircle size={14} className="text-amber-400 flex-shrink-0" />
                <p className="text-amber-300 text-sm">{email} non connecte</p>
              </div>
              <a
                href={`/api/calendar/connect?email=${encodeURIComponent(email)}`}
                className="flex items-center gap-1.5 text-sm text-amber-400 hover:text-amber-300 transition-colors whitespace-nowrap"
              >
                <Link2 size={12} />
                Connecter
              </a>
            </div>
          ))}
        </div>
      )}

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
              <p className="text-slate-500">Aucun rendez-vous a venir</p>
              <p className="text-slate-600 text-sm mt-1">Les prochains rendez-vous apparaitront ici</p>
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
                    const calColor = getCalendarColor(event.calendarEmail)
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
                              {event.location && (
                                <span className="flex items-center gap-1.5 text-slate-500 text-xs truncate max-w-[250px]">
                                  <MapPin size={11} />
                                  {event.location}
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

        {/* Sidebar: mini calendar + legend */}
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

          {/* Calendar legend */}
          {data && data.calendarEmails.length > 0 && (
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
              <h3 className="text-white text-sm font-semibold mb-3">Agendas</h3>
              <div className="space-y-2">
                {data.calendarEmails.map(email => {
                  const connected = !data.notConnected.includes(email)
                  return (
                    <div key={email} className="flex items-center gap-2">
                      <div className={cn('w-2.5 h-2.5 rounded-full', connected ? getCalendarColor(email) : 'bg-slate-700')} />
                      <span className={cn('text-xs truncate', connected ? 'text-slate-300' : 'text-slate-600')}>
                        {email}
                      </span>
                      {!connected && (
                        <a
                          href={`/api/calendar/connect?email=${encodeURIComponent(email)}`}
                          className="text-[10px] text-amber-400 hover:text-amber-300 ml-auto flex-shrink-0"
                        >
                          Connecter
                        </a>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
