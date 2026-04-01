'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Briefcase, Loader2, Users2, TrendingUp, Phone, Euro, CheckCircle2, Mail, Video, PhoneCall, XCircle } from 'lucide-react'
import { ROLE_AVATAR_COLORS } from '@/lib/utils'
import { usePolling } from '@/hooks/usePolling'

interface Commercial {
  id: string
  name: string
  email: string
  role: string
}

interface CommercialStats {
  leads: number
  ventes: number
  relances: number
  commissions: number
  mailsEnvoyes: number
  visiosPlanifiees: number
  aRappeler: number
  refuses: number
}

export default function CommerciauxPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [commerciaux, setCommerciaux] = useState<Commercial[]>([])
  const [direction, setDirection] = useState<Commercial[]>([])
  const [stats, setStats] = useState<Record<string, CommercialStats>>({})
  const [loading, setLoading] = useState(true)

  const userRole = (session?.user as { role?: string })?.role
  const userId = (session?.user as { id?: string })?.id

  // Redirect COMMERCIAL users to their own page
  useEffect(() => {
    if (status === 'authenticated' && userRole === 'COMMERCIAL' && userId) {
      router.replace(`/commerciaux/${userId}`)
    }
  }, [status, userRole, userId, router])

  // Fetch commerciaux and their stats
  useEffect(() => {
    if (status !== 'authenticated' || userRole === 'COMMERCIAL') return

    async function load() {
      try {
        const usersRes = await fetch('/api/users')
        const users: Commercial[] = await usersRes.json()
        const filtered = users.filter(u => u.role === 'COMMERCIAL')
        const admins = users.filter(u => u.role === 'ADMIN')
        setCommerciaux(filtered)
        setDirection(admins)

        const allUsers = [...filtered, ...admins]
        const statsMap: Record<string, CommercialStats> = {}
        await Promise.all(
          allUsers.map(async (c) => {
            const [prospectsRes, relancesRes, commissionsRes] = await Promise.all([
              fetch(`/api/prospects?userId=${c.id}`),
              fetch(`/api/relances?userId=${c.id}`),
              fetch(`/api/commissions?userId=${c.id}`),
            ])
            const prospects = await prospectsRes.json()
            const relances = await relancesRes.json()
            const commissions = await commissionsRes.json()

            const prospectArr = Array.isArray(prospects) ? prospects : []
            const hasHadStatus = (p: { status?: string; statusHistory?: string[] }, s: string) =>
              p.status === s || (p.statusHistory || []).includes(s)

            statsMap[c.id] = {
              leads: prospectArr.length,
              ventes: prospectArr.filter((p: { status?: string; statusHistory?: string[] }) => hasHadStatus(p, 'SIGNE')).length,
              mailsEnvoyes: prospectArr.filter((p: { status?: string; statusHistory?: string[] }) => hasHadStatus(p, 'MAIL_ENVOYE')).length,
              visiosPlanifiees: prospectArr.filter((p: { status?: string; statusHistory?: string[] }) => hasHadStatus(p, 'VISIO_PLANIFIE')).length,
              aRappeler: prospectArr.filter((p: { status?: string }) => p.status === 'A_RAPPELER').length,
              refuses: prospectArr.filter((p: { status?: string; statusHistory?: string[] }) => hasHadStatus(p, 'REFUSE')).length,
              relances: Array.isArray(relances) ? relances.length : 0,
              commissions: Array.isArray(commissions)
                ? commissions.reduce((sum: number, c: { amount?: number }) => sum + (c.amount ?? 0), 0)
                : typeof commissions?.total === 'number' ? commissions.total : 0,
            }
          })
        )
        setStats(statsMap)
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [status, userRole])

  function buildStats(prospects: { status?: string; statusHistory?: string[] }[], relances: unknown[], commissions: { amount?: number }[]) {
    const prospectArr = Array.isArray(prospects) ? prospects : []
    const hasHadStatus = (p: { status?: string; statusHistory?: string[] }, s: string) =>
      p.status === s || (p.statusHistory || []).includes(s)

    return {
      leads: prospectArr.length,
      ventes: prospectArr.filter(p => hasHadStatus(p, 'SIGNE')).length,
      mailsEnvoyes: prospectArr.filter(p => hasHadStatus(p, 'MAIL_ENVOYE')).length,
      visiosPlanifiees: prospectArr.filter(p => hasHadStatus(p, 'VISIO_PLANIFIE')).length,
      aRappeler: prospectArr.filter(p => p.status === 'A_RAPPELER').length,
      refuses: prospectArr.filter(p => hasHadStatus(p, 'REFUSE')).length,
      relances: Array.isArray(relances) ? relances.length : 0,
      commissions: Array.isArray(commissions)
        ? commissions.reduce((sum: number, c) => sum + (c.amount ?? 0), 0)
        : 0,
    }
  }

  function refreshData() {
    if (status !== 'authenticated' || userRole === 'COMMERCIAL') return
    async function load() {
      try {
        const usersRes = await fetch('/api/users')
        const users: Commercial[] = await usersRes.json()
        const filtered = users.filter(u => u.role === 'COMMERCIAL')
        const admins = users.filter(u => u.role === 'ADMIN')
        setCommerciaux(filtered)
        setDirection(admins)

        const allUsers = [...filtered, ...admins]
        const statsMap: Record<string, CommercialStats> = {}
        await Promise.all(
          allUsers.map(async (c) => {
            const [prospectsRes, relancesRes, commissionsRes] = await Promise.all([
              fetch(`/api/prospects?userId=${c.id}`),
              fetch(`/api/relances?userId=${c.id}`),
              fetch(`/api/commissions?userId=${c.id}`),
            ])
            const prospects = await prospectsRes.json()
            const relances = await relancesRes.json()
            const commissions = await commissionsRes.json()
            statsMap[c.id] = buildStats(prospects, relances, commissions)
          })
        )
        setStats(statsMap)
      } catch {
        // silently fail
      }
    }
    load()
  }
  usePolling(refreshData)

  // Show spinner while session loads or while redirecting
  if (status === 'loading' || userRole === 'COMMERCIAL') {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a12]">
        <Loader2 size={24} className="animate-spin text-slate-500" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
          <Briefcase size={20} className="text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-white">Commerciaux</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {commerciaux.length + direction.length} membre{commerciaux.length + direction.length > 1 ? 's' : ''} dans l&apos;equipe commerciale
          </p>
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 size={24} className="animate-spin text-slate-500" />
        </div>
      ) : commerciaux.length === 0 && direction.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-800/50 flex items-center justify-center mb-4">
            <Users2 size={24} className="text-slate-600" />
          </div>
          <p className="text-slate-400 text-sm">Aucun commercial pour le moment</p>
          <p className="text-slate-600 text-xs mt-1">Les utilisateurs avec le role Commercial apparaitront ici</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Direction */}
          {direction.length > 0 && (
            <div>
              <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Direction</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {direction.map(c => {
                  const s = stats[c.id] ?? { leads: 0, ventes: 0, relances: 0, commissions: 0, mailsEnvoyes: 0, visiosPlanifiees: 0, aRappeler: 0, refuses: 0 }
                  const gradient = ROLE_AVATAR_COLORS.ADMIN
                  const initials = c.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
                  const statItems = [
                    { icon: TrendingUp, color: 'text-emerald-400', label: 'Leads', value: s.leads },
                    { icon: Mail, color: 'text-teal-400', label: 'Mails envoyes', value: s.mailsEnvoyes },
                    { icon: Video, color: 'text-indigo-400', label: 'Visios planifiees', value: s.visiosPlanifiees },
                    { icon: PhoneCall, color: 'text-orange-400', label: 'A rappeler', value: s.aRappeler },
                    { icon: CheckCircle2, color: 'text-green-400', label: 'Ventes', value: s.ventes },
                    { icon: XCircle, color: 'text-red-400', label: 'Refuses', value: s.refuses },
                    { icon: Phone, color: 'text-blue-400', label: 'Relances', value: s.relances },
                    { icon: Euro, color: 'text-amber-400', label: 'Commissions', value: s.commissions, suffix: '\u20AC' },
                  ]
                  return (
                    <Link key={c.id} href={`/commerciaux/${c.id}`} className="bg-[#111118] border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors group">
                      <div className="flex items-center gap-3 mb-5">
                        <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}>
                          <span className="text-white font-semibold text-sm">{initials}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-medium text-sm truncate group-hover:text-emerald-400 transition-colors">{c.name}</p>
                          <p className="text-slate-500 text-xs">Direction</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        {statItems.map(item => (
                          <div key={item.label} className="flex items-center gap-2 text-xs text-slate-400">
                            <item.icon size={12} className={item.color} />
                            <span className="text-white font-medium">{item.value}{item.suffix || ''}</span>
                            <span className="truncate">{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* Commerciaux */}
          {commerciaux.length > 0 && (
            <div>
              <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Commerciaux</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {commerciaux.map(c => {
                  const s = stats[c.id] ?? { leads: 0, ventes: 0, relances: 0, commissions: 0, mailsEnvoyes: 0, visiosPlanifiees: 0, aRappeler: 0, refuses: 0 }
                  const gradient = ROLE_AVATAR_COLORS.COMMERCIAL
                  const initials = c.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
                  const statItems = [
                    { icon: TrendingUp, color: 'text-emerald-400', label: 'Leads', value: s.leads },
                    { icon: Mail, color: 'text-teal-400', label: 'Mails envoyes', value: s.mailsEnvoyes },
                    { icon: Video, color: 'text-indigo-400', label: 'Visios planifiees', value: s.visiosPlanifiees },
                    { icon: PhoneCall, color: 'text-orange-400', label: 'A rappeler', value: s.aRappeler },
                    { icon: CheckCircle2, color: 'text-green-400', label: 'Ventes', value: s.ventes },
                    { icon: XCircle, color: 'text-red-400', label: 'Refuses', value: s.refuses },
                    { icon: Phone, color: 'text-blue-400', label: 'Relances', value: s.relances },
                    { icon: Euro, color: 'text-amber-400', label: 'Commissions', value: s.commissions, suffix: '\u20AC' },
                  ]
                  return (
                    <Link key={c.id} href={`/commerciaux/${c.id}`} className="bg-[#111118] border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors group">
                      <div className="flex items-center gap-3 mb-5">
                        <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}>
                          <span className="text-white font-semibold text-sm">{initials}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-medium text-sm truncate group-hover:text-emerald-400 transition-colors">{c.name}</p>
                          <p className="text-slate-500 text-xs">Commercial</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        {statItems.map(item => (
                          <div key={item.label} className="flex items-center gap-2 text-xs text-slate-400">
                            <item.icon size={12} className={item.color} />
                            <span className="text-white font-medium">{item.value}{item.suffix || ''}</span>
                            <span className="truncate">{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
