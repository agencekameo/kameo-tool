'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Briefcase, Loader2, Users2, TrendingUp, Phone, Euro, CheckCircle2 } from 'lucide-react'
import { ROLE_AVATAR_COLORS } from '@/lib/utils'

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
}

export default function CommerciauxPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [commerciaux, setCommerciaux] = useState<Commercial[]>([])
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
        setCommerciaux(filtered)

        const statsMap: Record<string, CommercialStats> = {}
        await Promise.all(
          filtered.map(async (c) => {
            const [prospectsRes, relancesRes, commissionsRes] = await Promise.all([
              fetch(`/api/prospects?userId=${c.id}`),
              fetch(`/api/relances?userId=${c.id}`),
              fetch(`/api/commissions?userId=${c.id}`),
            ])
            const prospects = await prospectsRes.json()
            const relances = await relancesRes.json()
            const commissions = await commissionsRes.json()

            statsMap[c.id] = {
              leads: Array.isArray(prospects) ? prospects.length : 0,
              ventes: Array.isArray(prospects) ? prospects.filter((p: { status?: string }) => p.status === 'SIGNE').length : 0,
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
            {commerciaux.length} commercial{commerciaux.length > 1 ? 's' : ''} dans l&apos;equipe
          </p>
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 size={24} className="animate-spin text-slate-500" />
        </div>
      ) : commerciaux.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-800/50 flex items-center justify-center mb-4">
            <Users2 size={24} className="text-slate-600" />
          </div>
          <p className="text-slate-400 text-sm">Aucun commercial pour le moment</p>
          <p className="text-slate-600 text-xs mt-1">Les utilisateurs avec le role Commercial apparaitront ici</p>
        </div>
      ) : (
        /* Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {commerciaux.map(c => {
            const s = stats[c.id] ?? { leads: 0, ventes: 0, relances: 0, commissions: 0 }
            const gradient = ROLE_AVATAR_COLORS.COMMERCIAL
            const initials = c.name
              .split(' ')
              .map(w => w[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)

            return (
              <Link
                key={c.id}
                href={`/commerciaux/${c.id}`}
                className="bg-[#111118] border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors group"
              >
                {/* Identity */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}>
                    <span className="text-white font-semibold text-sm">{initials}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-medium text-sm truncate group-hover:text-emerald-400 transition-colors">
                      {c.name}
                    </p>
                    <p className="text-slate-500 text-xs">Commercial</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-3 text-xs flex-wrap">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <TrendingUp size={12} className="text-emerald-400" />
                    <span>{s.leads} lead{s.leads > 1 ? 's' : ''}</span>
                  </div>
                  <span className="text-slate-700">|</span>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <CheckCircle2 size={12} className="text-green-400" />
                    <span>{s.ventes} vente{s.ventes > 1 ? 's' : ''}</span>
                  </div>
                  <span className="text-slate-700">|</span>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Phone size={12} className="text-blue-400" />
                    <span>{s.relances} relance{s.relances > 1 ? 's' : ''}</span>
                  </div>
                  <span className="text-slate-700">|</span>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Euro size={12} className="text-amber-400" />
                    <span>{s.commissions}&euro;</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
