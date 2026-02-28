'use client'

import { useEffect, useState } from 'react'
import { Star, StarOff, CheckCircle2, Clock, Filter, XCircle } from 'lucide-react'
import {
  PROJECT_STATUS_COLORS,
  PROJECT_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
} from '@/lib/utils'

interface Project {
  id: string
  name: string
  type: string
  status: string
  reviewReceived: boolean
  reviewExcluded: boolean
  client: { id: string; name: string; company?: string }
}

type FilterTab = 'all' | 'received' | 'missing' | 'excluded'

const DELIVERED_STATUSES = ['LIVRAISON', 'MAINTENANCE', 'ARCHIVE']

const CLIENT_GRADIENT_PAIRS = [
  'from-violet-500 to-purple-700',
  'from-blue-500 to-blue-700',
  'from-emerald-500 to-teal-700',
  'from-amber-500 to-orange-600',
  'from-[#E14B89] to-pink-700',
  'from-cyan-500 to-blue-600',
  'from-rose-500 to-pink-700',
  'from-indigo-500 to-violet-700',
]

function getGradient(name: string): string {
  const idx = name.charCodeAt(0) % CLIENT_GRADIENT_PAIRS.length
  return CLIENT_GRADIENT_PAIRS[idx]
}

const TYPE_COLORS: Record<string, string> = {
  WORDPRESS: 'bg-blue-500/15 text-blue-400',
  FRAMER: 'bg-[#E14B89]/15 text-[#E14B89]',
  CUSTOM: 'bg-amber-500/15 text-amber-400',
  ECOMMERCE: 'bg-emerald-500/15 text-emerald-400',
}

export default function AvisPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then((data: Project[]) => {
        setProjects(data.filter(p => DELIVERED_STATUSES.includes(p.status)))
      })
      .finally(() => setLoading(false))
  }, [])

  const receivedCount = projects.filter(p => p.reviewReceived && !p.reviewExcluded).length
  const missingCount = projects.filter(p => !p.reviewReceived && !p.reviewExcluded).length
  const excludedCount = projects.filter(p => p.reviewExcluded).length
  const denominator = projects.length - excludedCount
  const receivedPercent =
    denominator > 0 ? Math.round((receivedCount / denominator) * 100) : 0

  const filtered = projects.filter(p => {
    if (activeTab === 'received') return p.reviewReceived && !p.reviewExcluded
    if (activeTab === 'missing') return !p.reviewReceived && !p.reviewExcluded
    if (activeTab === 'excluded') return p.reviewExcluded
    return true
  })

  async function toggleReview(project: Project) {
    if (toggling) return
    setToggling(project.id)

    // Determine next state in the cycle:
    // En attente (false, false) → Avis reçu (true, false) → Hors catégorie (false, true) → En attente (false, false)
    let nextReceived: boolean
    let nextExcluded: boolean

    if (!project.reviewReceived && !project.reviewExcluded) {
      // En attente → Avis reçu
      nextReceived = true
      nextExcluded = false
    } else if (project.reviewReceived && !project.reviewExcluded) {
      // Avis reçu → Hors catégorie
      nextReceived = false
      nextExcluded = true
    } else {
      // Hors catégorie → En attente
      nextReceived = false
      nextExcluded = false
    }

    // Optimistic update
    setProjects(prev =>
      prev.map(p =>
        p.id === project.id
          ? { ...p, reviewReceived: nextReceived, reviewExcluded: nextExcluded }
          : p
      )
    )

    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewReceived: nextReceived, reviewExcluded: nextExcluded }),
      })
      if (!res.ok) {
        // Revert on failure
        setProjects(prev =>
          prev.map(p =>
            p.id === project.id
              ? {
                  ...p,
                  reviewReceived: project.reviewReceived,
                  reviewExcluded: project.reviewExcluded,
                }
              : p
          )
        )
      }
    } catch {
      setProjects(prev =>
        prev.map(p =>
          p.id === project.id
            ? {
                ...p,
                reviewReceived: project.reviewReceived,
                reviewExcluded: project.reviewExcluded,
              }
            : p
        )
      )
    } finally {
      setToggling(null)
    }
  }

  const TABS: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'Tous', count: projects.length },
    { key: 'received', label: 'Avis reçu', count: receivedCount },
    { key: 'missing', label: 'En attente', count: missingCount },
    { key: 'excluded', label: 'Hors catégorie', count: excludedCount },
  ]

  return (
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center">
            <Star size={18} className="text-amber-400" />
          </div>
          <h1 className="text-2xl font-semibold text-white">Avis Google</h1>
        </div>
        <p className="text-slate-400 text-sm mt-1 ml-12">
          Suivi des avis Google reçus pour les projets livrés
        </p>
      </div>

      {/* Summary bar */}
      <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5 mb-6">
        <div className="flex flex-wrap items-center gap-6">
          {/* Stat 1 - Total */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
              <Filter size={16} className="text-slate-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{projects.length}</p>
              <p className="text-slate-500 text-xs">projets livrés</p>
            </div>
          </div>

          <div className="h-10 w-px bg-slate-800 hidden sm:block" />

          {/* Stat 2 - Received */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <CheckCircle2 size={16} className="text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-400">{receivedCount}</p>
              <p className="text-slate-500 text-xs">avis reçus</p>
            </div>
          </div>

          <div className="h-10 w-px bg-slate-800 hidden sm:block" />

          {/* Stat 3 - Missing */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
              <Clock size={16} className="text-rose-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-rose-400">{missingCount}</p>
              <p className="text-slate-500 text-xs">en attente</p>
            </div>
          </div>

          <div className="h-10 w-px bg-slate-800 hidden sm:block" />

          {/* Stat 4 - Excluded */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-700/50 flex items-center justify-center">
              <XCircle size={16} className="text-slate-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-400">{excludedCount}</p>
              <p className="text-slate-500 text-xs">hors catégorie</p>
            </div>
          </div>

          <div className="h-10 w-px bg-slate-800 hidden sm:block" />

          {/* Progress bar */}
          <div className="flex-1 min-w-[160px]">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-slate-400">Taux de conversion</span>
              <span className="text-white font-semibold">{receivedPercent}%</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${receivedPercent}%`,
                  background:
                    receivedPercent >= 70
                      ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                      : receivedPercent >= 40
                      ? 'linear-gradient(90deg, #f97316, #fb923c)'
                      : 'linear-gradient(90deg, #f43f5e, #fb7185)',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 bg-[#111118] border border-slate-800 rounded-xl p-1 mb-6 w-fit">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
              activeTab === tab.key
                ? 'bg-[#E14B89] text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab.label}
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-500'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Project list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="h-20 bg-[#111118] border border-slate-800 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/60 flex items-center justify-center mb-4">
            <StarOff size={28} className="text-slate-600" />
          </div>
          <p className="text-slate-400 font-medium">Aucun projet trouvé</p>
          <p className="text-slate-600 text-sm mt-1">Essayez un autre filtre</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {/* Column headers */}
          <div className="hidden sm:flex items-center gap-4 px-5 pb-1">
            <div className="flex-1">
              <span className="text-slate-600 text-xs uppercase tracking-wide font-medium">
                Projet / Client
              </span>
            </div>
            <div className="w-28 text-center">
              <span className="text-slate-600 text-xs uppercase tracking-wide font-medium">
                Type
              </span>
            </div>
            <div className="w-28 text-center">
              <span className="text-slate-600 text-xs uppercase tracking-wide font-medium">
                Statut
              </span>
            </div>
            <div className="w-36 text-right">
              <span className="text-slate-600 text-xs uppercase tracking-wide font-medium">
                Avis Google
              </span>
            </div>
          </div>

          {filtered.map(project => {
            const initial = project.client.name[0].toUpperCase()
            const gradient = getGradient(project.client.name)
            const isToggling = toggling === project.id

            // Determine current state
            const isReceived = project.reviewReceived && !project.reviewExcluded
            const isExcluded = project.reviewExcluded
            // isWaiting = !isReceived && !isExcluded

            return (
              <div
                key={project.id}
                className="flex items-center gap-4 bg-[#111118] border border-slate-800 rounded-2xl px-5 py-4 hover:border-slate-700 transition-colors group"
              >
                {/* Avatar */}
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0 shadow-lg`}
                >
                  <span className="text-white font-bold text-sm">{initial}</span>
                </div>

                {/* Project & client info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm leading-tight truncate group-hover:text-slate-100">
                    {project.name}
                  </p>
                  <p className="text-slate-400 text-xs mt-0.5 truncate">
                    {project.client.name}
                    {project.client.company && (
                      <span className="text-slate-600"> · {project.client.company}</span>
                    )}
                  </p>
                </div>

                {/* Type badge */}
                <div className="hidden sm:flex w-28 justify-center">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      TYPE_COLORS[project.type] ?? 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {PROJECT_TYPE_LABELS[project.type] ?? project.type}
                  </span>
                </div>

                {/* Status badge */}
                <div className="hidden sm:flex w-28 justify-center">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      PROJECT_STATUS_COLORS[project.status] ?? 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {PROJECT_STATUS_LABELS[project.status] ?? project.status}
                  </span>
                </div>

                {/* Review toggle */}
                <div className="flex-shrink-0 w-36 flex justify-end">
                  {isReceived ? (
                    <button
                      onClick={() => toggleReview(project)}
                      disabled={isToggling}
                      className="flex items-center gap-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-60 cursor-pointer"
                    >
                      <CheckCircle2 size={13} />
                      Avis reçu
                    </button>
                  ) : isExcluded ? (
                    <button
                      onClick={() => toggleReview(project)}
                      disabled={isToggling}
                      className="flex items-center gap-2 bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 text-orange-400 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-60 cursor-pointer"
                    >
                      <XCircle size={13} />
                      Hors catégorie
                    </button>
                  ) : (
                    <button
                      onClick={() => toggleReview(project)}
                      disabled={isToggling}
                      className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-slate-300 px-3.5 py-2 rounded-xl text-xs font-medium transition-all disabled:opacity-60 cursor-pointer"
                    >
                      <Clock size={13} />
                      En attente
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Footer note */}
      {!loading && projects.length > 0 && (
        <p className="text-slate-600 text-xs text-center mt-8">
          Cliquez sur le badge d&apos;un projet pour faire cycler l&apos;état de l&apos;avis Google
        </p>
      )}
    </div>
  )
}
