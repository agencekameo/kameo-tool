'use client'

import { useEffect, useState } from 'react'
import { Calendar, MapPin, Clock, ExternalLink, AlertCircle, RefreshCw, Link2 } from 'lucide-react'
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

function formatEventDate(start: string, end: string, allDay: boolean) {
  if (!start) return ''
  const startDate = new Date(start)
  const endDate = new Date(end)
  const now = new Date()

  const isToday = startDate.toDateString() === now.toDateString()
  const isTomorrow = new Date(now.getTime() + 86400000).toDateString() === startDate.toDateString()

  const dayLabel = isToday ? 'Aujourd\'hui' : isTomorrow ? 'Demain' : startDate.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })

  if (allDay) return dayLabel

  const startTime = startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const endTime = endDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  return `${dayLabel} · ${startTime}–${endTime}`
}

function getDayBadge(start: string) {
  const startDate = new Date(start)
  const now = new Date()
  const isToday = startDate.toDateString() === now.toDateString()
  const isTomorrow = new Date(now.getTime() + 86400000).toDateString() === startDate.toDateString()
  if (isToday) return { label: 'Aujourd\'hui', color: 'bg-[#E14B89]/15 text-[#E14B89] border border-[#E14B89]/20' }
  if (isTomorrow) return { label: 'Demain', color: 'bg-amber-500/15 text-amber-400 border border-amber-500/20' }
  return null
}

function getCalendarColor(email: string) {
  if (email.includes('louison')) return 'bg-purple-500'
  return 'bg-[#E14B89]'
}

export function CalendarWidget() {
  const [data, setData] = useState<CalendarData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  return (
    <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-[#E14B89]" />
          <h2 className="text-white font-semibold">Rendez-vous</h2>
        </div>
        <button
          onClick={fetchEvents}
          className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded"
          title="Rafraîchir"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Not connected banners */}
      {data?.notConnected && data.notConnected.length > 0 && (
        <div className="space-y-2 mb-4">
          {data.notConnected.map(email => (
            <div key={email} className="flex items-center justify-between gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <div className="flex items-center gap-2">
                <AlertCircle size={13} className="text-amber-400 flex-shrink-0" />
                <p className="text-amber-300 text-xs">{email} non connecté</p>
              </div>
              <a
                href={`/api/calendar/connect?email=${encodeURIComponent(email)}`}
                className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors whitespace-nowrap"
              >
                <Link2 size={11} />
                Connecter
              </a>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="space-y-2.5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 bg-slate-800/40 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="text-center py-6">
          <p className="text-slate-500 text-sm">{error}</p>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {data.events.length === 0 && data.notConnected.length === 0 && (
            <div className="text-center py-8">
              <Calendar size={28} className="text-slate-700 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">Aucun rendez-vous à venir</p>
            </div>
          )}

          {data.events.length === 0 && data.notConnected.length > 0 && (
            <div className="text-center py-4">
              <p className="text-slate-600 text-xs">Connectez vos agendas pour voir vos rendez-vous</p>
            </div>
          )}

          <div className="space-y-2">
            {data.events.map((event, i) => {
              const badge = getDayBadge(event.start)
              const calColor = getCalendarColor(event.calendarEmail)
              return (
                <div
                  key={`${event.id}-${i}`}
                  className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-800/30 transition-colors group"
                >
                  {/* Color dot */}
                  <div className="flex flex-col items-center gap-0.5 flex-shrink-0 mt-1">
                    <div className={cn('w-2 h-2 rounded-full flex-shrink-0', calColor)} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-slate-200 text-sm font-medium truncate leading-tight">
                        {event.title}
                      </p>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {badge && (
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap', badge.color)}>
                            {badge.label}
                          </span>
                        )}
                        {event.htmlLink && (
                          <a
                            href={event.htmlLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-600 hover:text-slate-400 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="flex items-center gap-1 text-slate-500 text-[11px]">
                        <Clock size={10} />
                        {formatEventDate(event.start, event.end, event.allDay)}
                      </span>
                      {event.location && (
                        <span className="flex items-center gap-1 text-slate-600 text-[11px] truncate max-w-[160px]">
                          <MapPin size={10} />
                          {event.location}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Calendar legend */}
          {data.calendarEmails.length > 1 && data.events.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center gap-3 flex-wrap">
              {data.calendarEmails.filter(e => !data.notConnected.includes(e)).map(email => (
                <div key={email} className="flex items-center gap-1.5">
                  <div className={cn('w-2 h-2 rounded-full', getCalendarColor(email))} />
                  <span className="text-slate-600 text-[10px]">{email}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
