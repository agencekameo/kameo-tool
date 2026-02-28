'use client'

import { useEffect, useState } from 'react'
import { Search, Loader2, TrendingUp, Smartphone, Monitor, Globe, ChevronDown, ChevronUp } from 'lucide-react'

interface Improvement {
  problem: string
  complexity: 'Simple' | 'Modérée' | 'Complexe'
  urgency: 'Secondaire' | 'Important' | 'Critique'
}

interface Audit {
  id: string
  url: string
  performanceMobile?: number
  performanceDesktop?: number
  seoScore?: number
  uxScore?: number
  responsiveScore?: number
  globalScore?: number
  improvements?: Improvement[]
  createdBy: { name: string }
  createdAt: string
}

interface Project { id: string; name: string; client: { name: string } }

const SCORE_COLOR = (score: number) =>
  score >= 80 ? 'text-green-400' : score >= 60 ? 'text-orange-400' : 'text-red-400'

const SCORE_BG = (score: number) =>
  score >= 80 ? 'bg-green-400' : score >= 60 ? 'bg-orange-400' : 'bg-red-400'

const URGENCY_COLORS: Record<string, string> = {
  Secondaire: 'bg-slate-800 text-slate-400',
  Important: 'bg-orange-500/15 text-orange-400',
  Critique: 'bg-red-500/15 text-red-400',
}

const COMPLEXITY_COLORS: Record<string, string> = {
  Simple: 'bg-green-500/15 text-green-400',
  Modérée: 'bg-blue-500/15 text-blue-400',
  Complexe: 'bg-[#E14B89]/10 text-[#E14B89]',
}

function ScoreRing({ score, label, size = 80 }: { score?: number; label: string; size?: number }) {
  const s = score ?? 0
  const radius = (size - 12) / 2
  const circumference = 2 * Math.PI * radius
  const dash = (s / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1e1e2e" strokeWidth={6} />
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke={s >= 80 ? '#4ade80' : s >= 60 ? '#fb923c' : '#f87171'}
            strokeWidth={6} strokeDasharray={`${dash} ${circumference}`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-bold text-lg ${SCORE_COLOR(s)}`}>{score ?? '—'}</span>
        </div>
      </div>
      <span className="text-slate-400 text-xs text-center">{label}</span>
    </div>
  )
}

export default function AuditPage() {
  const [url, setUrl] = useState('')
  const [projectId, setProjectId] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [audits, setAudits] = useState<Audit[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [currentAudit, setCurrentAudit] = useState<Audit | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [auditError, setAuditError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/audit').then(r => r.json()),
      fetch('/api/projects').then(r => r.json()),
    ]).then(([a, p]) => { setAudits(a); setProjects(p) }).finally(() => setLoadingHistory(false))
  }, [])

  async function handleAudit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setCurrentAudit(null)
    setAuditError(null)
    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, projectId: projectId || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAuditError(data.error ?? 'Erreur lors de l\'audit')
      } else {
        setCurrentAudit(data)
        setAudits(prev => [data, ...prev])
      }
    } catch {
      setAuditError('Impossible de joindre l\'API PageSpeed. Vérifiez l\'URL et réessayez.')
    } finally {
      setLoading(false)
    }
  }

  const displayAudit = currentAudit

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Audit SEO</h1>
        <p className="text-slate-400 text-sm mt-1">Analyse de performance et SEO via PageSpeed Insights</p>
      </div>

      {/* Form */}
      <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 mb-8">
        <form onSubmit={handleAudit} className="flex gap-3">
          <div className="flex-1 relative">
            <Globe size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={url} onChange={e => setUrl(e.target.value)} required placeholder="https://exemple.com"
              className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#E14B89] transition-colors" />
          </div>
          <select value={projectId} onChange={e => setProjectId(e.target.value)}
            className="bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors w-48">
            <option value="">Lier à un projet</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.client.name} · {p.name}</option>)}
          </select>
          <button type="submit" disabled={loading}
            className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 disabled:opacity-50 text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors flex-shrink-0">
            {loading ? <><Loader2 size={16} className="animate-spin" /> Analyse...</> : <><Search size={16} /> Lancer l&apos;audit</>}
          </button>
        </form>
        {auditError && (
          <div className="mt-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            ⚠ {auditError}
          </div>
        )}
      </div>

      {/* Results */}
      {displayAudit && (
        <div className="space-y-6 mb-10">
          {/* Scores */}
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-white font-semibold text-lg">Résultats — {displayAudit.url}</h2>
                <p className="text-slate-400 text-sm mt-0.5">Analyse complète PageSpeed Insights</p>
              </div>
              {/* Global score */}
              <div className="text-center">
                <div className={`text-4xl font-bold ${SCORE_COLOR(displayAudit.globalScore ?? 0)}`}>
                  {displayAudit.globalScore}/100
                </div>
                <p className="text-slate-400 text-xs mt-1">Score global SEO</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6 mb-6">
              <ScoreRing score={displayAudit.performanceMobile} label="Perf. Mobile" />
              <ScoreRing score={displayAudit.performanceDesktop} label="Perf. Desktop" />
              <ScoreRing score={displayAudit.seoScore} label="SEO Technique" />
              <ScoreRing score={displayAudit.uxScore} label="Expérience UX" />
              <ScoreRing score={displayAudit.responsiveScore} label="Responsive" />
            </div>

            {/* Calcul détaillé */}
            <div className="bg-[#0d0d14] rounded-xl p-4 text-xs font-mono text-slate-400 border border-slate-800">
              <p className="text-slate-300 font-sans font-medium mb-2 text-sm">Calcul du score global (pondération Kameo)</p>
              {(() => {
                const avgPerf = Math.round(((displayAudit.performanceMobile ?? 0) + (displayAudit.performanceDesktop ?? 0)) / 2)
                return (
                  <>
                    <p>Performances (×1) : {avgPerf} × 1 = <span className={SCORE_COLOR(avgPerf)}>{avgPerf}</span></p>
                    <p>SEO Technique (×1) : {displayAudit.seoScore} × 1 = <span className={SCORE_COLOR(displayAudit.seoScore ?? 0)}>{displayAudit.seoScore}</span></p>
                    <p>Expérience UX (×0.5) : {displayAudit.uxScore} × 0.5 = <span className={SCORE_COLOR(displayAudit.uxScore ?? 0)}>{Math.round((displayAudit.uxScore ?? 0) * 0.5)}</span></p>
                    <p>Responsive (×1) : {displayAudit.responsiveScore} × 1 = <span className={SCORE_COLOR(displayAudit.responsiveScore ?? 0)}>{displayAudit.responsiveScore}</span></p>
                    <p className="mt-2 pt-2 border-t border-slate-700 text-white">
                      Score = ({avgPerf} + {displayAudit.seoScore} + {Math.round((displayAudit.uxScore ?? 0) * 0.5)} + {displayAudit.responsiveScore}) ÷ 3.5 = <span className={`font-bold ${SCORE_COLOR(displayAudit.globalScore ?? 0)}`}>{displayAudit.globalScore}/100</span>
                    </p>
                  </>
                )
              })()}
            </div>
          </div>

          {/* Improvements */}
          {displayAudit.improvements && displayAudit.improvements.length > 0 && (
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
              <h2 className="text-white font-semibold mb-4">Axes d&apos;amélioration prioritaires</h2>
              <div className="space-y-2">
                {(displayAudit.improvements as Improvement[]).map((item, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-[#0d0d14] border border-slate-800">
                    <span className="text-white text-sm flex-1">{item.problem}</span>
                    <span className={`text-xs px-2.5 py-1 rounded-full flex-shrink-0 ${COMPLEXITY_COLORS[item.complexity]}`}>
                      {item.complexity}
                    </span>
                    <span className={`text-xs px-2.5 py-1 rounded-full flex-shrink-0 font-medium ${URGENCY_COLORS[item.urgency]}`}>
                      {item.urgency}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* History */}
      <div>
        <h2 className="text-white font-semibold mb-4">Historique des audits</h2>
        {loadingHistory ? (
          <div className="text-slate-500 text-sm">Chargement...</div>
        ) : audits.filter(a => a.id !== displayAudit?.id).length === 0 ? (
          <p className="text-slate-500 text-sm">Aucun audit précédent</p>
        ) : (
          <div className="space-y-3">
            {audits.filter(a => a.id !== displayAudit?.id).map(audit => (
              <div key={audit.id} className="bg-[#111118] border border-slate-800 rounded-2xl overflow-hidden">
                <button onClick={() => setExpandedId(expandedId === audit.id ? null : audit.id)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-slate-800/20 transition-colors">
                  <div className="flex-1 text-left">
                    <p className="text-white text-sm font-medium">{audit.url}</p>
                    <p className="text-slate-500 text-xs mt-0.5">par {audit.createdBy.name} · {new Date(audit.createdAt).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Smartphone size={12} />
                        <span className={SCORE_COLOR(audit.performanceMobile ?? 0)}>{audit.performanceMobile}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Monitor size={12} />
                        <span className={SCORE_COLOR(audit.performanceDesktop ?? 0)}>{audit.performanceDesktop}</span>
                      </div>
                    </div>
                    <div className={`text-xl font-bold ${SCORE_COLOR(audit.globalScore ?? 0)}`}>{audit.globalScore}</div>
                    {expandedId === audit.id ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                  </div>
                </button>
                {expandedId === audit.id && audit.improvements && (audit.improvements as Improvement[]).length > 0 && (
                  <div className="px-4 pb-4 border-t border-slate-800 pt-3 space-y-2">
                    {(audit.improvements as Improvement[]).map((item, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <span className="text-slate-300 flex-1">{item.problem}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${COMPLEXITY_COLORS[item.complexity]}`}>{item.complexity}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${URGENCY_COLORS[item.urgency]}`}>{item.urgency}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
