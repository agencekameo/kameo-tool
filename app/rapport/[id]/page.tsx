'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Gauge, Tag, FileText, MonitorSmartphone, Settings, UserCheck, ArrowRight, Calendar, ExternalLink, ChevronDown } from 'lucide-react'
import { useParams } from 'next/navigation'
import Image from 'next/image'

// ── Types ───────────────────────────────────────────────────────────────────────

interface Improvement {
  problem: string
  category: 'Balises' | 'Contenu' | 'Responsive' | 'Performances' | 'UX' | 'Config'
  urgency: 'Secondaire' | 'Important' | 'Critique'
}

interface AuditScores {
  performance: number
  balises: number
  content: number
  responsive: number
  config: number
  ux: number
}

interface Audit {
  id: string
  url: string
  performanceMobile?: number
  performanceDesktop?: number
  globalScore?: number
  technology?: string
  keywords?: string
  details?: {
    scores?: AuditScores
    logoUrl?: string
    descriptions?: Record<string, string>
  }
  improvements?: Improvement[]
  createdBy: { name: string }
  createdAt: string
  project?: { client: { name: string } } | null
}

// ── Constants ───────────────────────────────────────────────────────────────────

const SCORE_COLOR = (s: number) => s >= 75 ? '#95DB7D' : s >= 50 ? '#FF9346' : '#FF4040'
const SCORE_TEXT = (s: number) => s >= 75 ? 'text-[#95DB7D]' : s >= 50 ? 'text-[#FF9346]' : 'text-[#FF4040]'
const SCORE_LABEL = (s: number) => s >= 90 ? 'Excellent' : s >= 75 ? 'Bien' : s >= 50 ? 'A optimiser' : 'Critique'

const URGENCY_STYLES: Record<string, string> = {
  Critique: 'bg-red-500/10 text-[#FF4040] border-slate-700/40',
  Important: 'bg-orange-500/10 text-[#FF9346] border-slate-700/40',
  Secondaire: 'bg-slate-700/30 text-slate-400 border-slate-700/40',
}

const CATEGORY_STYLES: Record<string, string> = {
  Balises: 'bg-purple-500/10 text-purple-400',
  Contenu: 'bg-blue-500/10 text-blue-400',
  Responsive: 'bg-cyan-500/10 text-cyan-400',
  Performances: 'bg-amber-500/10 text-amber-400',
  UX: 'bg-pink-500/10 text-pink-400',
  Config: 'bg-slate-500/10 text-slate-400',
}

type CatKey = 'performance' | 'balises' | 'content' | 'responsive' | 'config' | 'ux'

const CATEGORIES: { key: CatKey; label: string; icon: typeof Gauge; brief: string; coeff: number }[] = [
  { key: 'balises', label: 'Balises', icon: Tag, brief: 'Balises title, meta description, titres Hn et données structurées', coeff: 2.5 },
  { key: 'content', label: 'Contenu', icon: FileText, brief: 'Qualité rédactionnelle, maillage interne et densité de mots-clés', coeff: 2.5 },
  { key: 'responsive', label: 'Responsive', icon: MonitorSmartphone, brief: 'Adaptation mobile, tablette et ergonomie tactile', coeff: 1.5 },
  { key: 'performance', label: 'Performances', icon: Gauge, brief: 'Vitesse de chargement, temps de réponse serveur et optimisation des ressources', coeff: 1.5 },
  { key: 'ux', label: 'Expérience UX', icon: UserCheck, brief: 'Navigation, accessibilité, lisibilité et parcours utilisateur', coeff: 1 },
  { key: 'config', label: 'Config. technique', icon: Settings, brief: 'HTTPS, sitemap, robots.txt, canonical et indexation Google', coeff: 1 },
]

// ── Animated Score Ring ─────────────────────────────────────────────────────────

function AnimatedRing({ score, size = 180, strokeWidth = 8, delay = 0, showLabel = false }: {
  score: number; size?: number; strokeWidth?: number; delay?: number; showLabel?: boolean
}) {
  const [current, setCurrent] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-50px' })

  useEffect(() => {
    if (!inView) return
    const timeout = setTimeout(() => {
      let frame = 0
      const total = 60
      const interval = setInterval(() => {
        frame++
        setCurrent(Math.round((frame / total) * score))
        if (frame >= total) clearInterval(interval)
      }, 16)
      return () => clearInterval(interval)
    }, delay)
    return () => clearTimeout(timeout)
  }, [inView, score, delay])

  const radius = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  const dash = (current / 100) * circumference
  const fontSize = size >= 150 ? 'text-5xl' : size >= 80 ? 'text-2xl' : 'text-lg'
  const subSize = size >= 150 ? 'text-sm' : 'text-[10px]'

  return (
    <div ref={ref} className="relative flex flex-col items-center" style={{ width: size, height: showLabel ? 'auto' : size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={SCORE_COLOR(score)} strokeWidth={strokeWidth}
          strokeDasharray={`${dash} ${circumference}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.3s ease' }} />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ top: 0, left: 0, width: size, height: size }}>
        <span className={`${fontSize} font-bold text-white`}>{current}</span>
        <span className={`${subSize} text-slate-400 -mt-0.5`}>/100</span>
      </div>
    </div>
  )
}

// ── Category Score Bar ──────────────────────────────────────────────────────────

function ScoreBar({ score, delay = 0 }: { score: number; delay?: number }) {
  const [width, setWidth] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-30px' })

  useEffect(() => {
    if (!inView) return
    const t = setTimeout(() => setWidth(score), delay)
    return () => clearTimeout(t)
  }, [inView, score, delay])

  return (
    <div ref={ref} className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-1000 ease-out"
        style={{ width: `${width}%`, background: `linear-gradient(90deg, ${SCORE_COLOR(score)}88, ${SCORE_COLOR(score)})` }} />
    </div>
  )
}

// ── Fade In Section ─────────────────────────────────────────────────────────────

function FadeIn({ children, delay = 0, className = '' }: {
  children: React.ReactNode; delay?: number; className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.6, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────────

export default function RapportPage() {
  const { id } = useParams()
  const [audit, setAudit] = useState<Audit | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/audit/${id}`).then(r => r.json()).then(data => {
      if (data.error) setError(data.error)
      else setAudit(data)
    }).catch(() => setError('Impossible de charger le rapport.')).finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08080f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-[#E14B89] border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Chargement du rapport...</p>
        </div>
      </div>
    )
  }

  if (error || !audit) {
    return (
      <div className="min-h-screen bg-[#08080f] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-2">Rapport introuvable</p>
          <p className="text-slate-500 text-sm">{error || "Ce lien n'est plus valide."}</p>
        </div>
      </div>
    )
  }

  const scores = audit.details?.scores ?? { performance: 0, balises: 0, content: 0, responsive: 0, config: 0, ux: 0 }
  const descriptions = audit.details?.descriptions ?? {}
  const domain = (() => { try { return new URL(audit.url).hostname } catch { return audit.url } })()
  const logoUrl = audit.details?.logoUrl || `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
  const globalScore = audit.globalScore ?? 0
  const clientName = audit.project?.client?.name
  const hasTech = audit.technology && audit.technology !== 'Non détecté' && audit.technology !== 'Site custom / non détecté'

  return (
    <div className="min-h-screen bg-[#08080f] text-white overflow-x-hidden">

      {/* ── Hero Section ──────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full opacity-15"
            style={{ background: `radial-gradient(circle, ${SCORE_COLOR(globalScore)}33, transparent 65%)` }} />
          <div className="absolute top-0 left-0 w-full h-full"
            style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(225,75,137,0.06) 0%, rgba(248,144,60,0.03) 30%, transparent 50%)' }} />
        </div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 flex flex-col items-center text-center max-w-3xl w-full"
        >
          {/* Kameo logo + label */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-3 mb-8"
          >
            <Image src="/kameo-logo.svg" alt="Kameo" width={120} height={34} className="opacity-70" />
            <span className="h-5 w-px bg-white/10" />
            <span className="brand-gradient-text text-xs font-semibold tracking-[0.15em] uppercase">Audit SEO</span>
          </motion.div>

          {/* Site card — groups logo, domain, client, pills */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="bg-white/[0.03] border border-white/[0.06] rounded-3xl px-8 py-7 mb-10 flex flex-col items-center gap-4 w-full max-w-md"
          >
            <img src={logoUrl} alt="" className="w-14 h-14 rounded-2xl bg-white/10 p-1.5 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            <div className="text-center">
              {clientName && <p className="text-slate-500 text-xs mb-1">{clientName}</p>}
              <p className="text-white text-xl font-semibold">{domain}</p>
            </div>
            {hasTech && (
              <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                <span className="px-4 py-1.5 rounded-full text-xs font-medium"
                  style={{ background: 'linear-gradient(135deg, rgba(225,75,137,0.1), rgba(248,144,60,0.1))', border: '1px solid rgba(225,75,137,0.2)' }}>
                  <span className="brand-gradient-text">{audit.technology}</span>
                </span>
              </div>
            )}
          </motion.div>

          {/* Score */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6, duration: 0.6 }}
          >
            <AnimatedRing score={globalScore} size={200} strokeWidth={10} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.5 }}
            className="mt-6"
          >
            <p className={`text-2xl font-bold ${SCORE_TEXT(globalScore)}`}>{SCORE_LABEL(globalScore)}</p>
            <p className="text-slate-500 text-xs mt-1.5">Score global de votre site</p>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 0.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-slate-600"
        >
          <span className="text-[10px] tracking-wider uppercase">Découvrir l&apos;analyse</span>
          <ChevronDown size={16} className="animate-bounce" />
        </motion.div>
      </section>

      {/* ── Scores Overview — Grid 2x3 ─────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <FadeIn>
            <p className="brand-gradient-text text-xs font-medium tracking-[0.2em] uppercase mb-3">Analyse détaillée</p>
            <h2 className="text-3xl font-bold text-white mb-10">6 critères analysés</h2>
          </FadeIn>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CATEGORIES.map((cat, i) => {
              const score = scores[cat.key]
              const Icon = cat.icon
              return (
                <FadeIn key={cat.key} delay={i * 0.08}>
                  <div className="group bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 hover:bg-white/[0.04] transition-all duration-300 h-full">
                    {/* Header: icon + label + score */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                          <Icon size={17} className="text-slate-400" />
                        </div>
                        <h3 className="text-white text-sm font-semibold">{cat.label}</h3>
                      </div>
                      <span className={`text-xl font-bold ${SCORE_TEXT(score)}`}>{score}</span>
                    </div>
                    {/* Bar */}
                    <ScoreBar score={score} delay={i * 80} />
                    {/* Description */}
                    <p className="text-slate-500 text-xs leading-relaxed mt-3">{cat.brief}</p>
                  </div>
                </FadeIn>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Improvements ──────────────────────────────────────────────────────── */}
      {audit.improvements && audit.improvements.length > 0 && (
        <section className="py-20 px-6">
          <div className="max-w-4xl mx-auto">
            <FadeIn>
              <p className="brand-gradient-text text-xs font-medium tracking-[0.2em] uppercase mb-3">Recommandations</p>
              <h2 className="text-3xl font-bold text-white mb-4">Axes d&apos;amélioration</h2>
              <p className="text-slate-400 text-sm mb-10">Les actions prioritaires pour améliorer votre site</p>
            </FadeIn>

            <div className="space-y-3 relative">
              {(audit.improvements as Improvement[]).map((item, i) => {
                const showAll = (audit.details as Record<string, unknown>)?.showAllImprovements === true
                const isBlurred = !showAll && i >= 5
                return (
                <FadeIn key={i} delay={i * 0.08}>
                  <div className={`flex items-center gap-4 p-4 rounded-xl border ${URGENCY_STYLES[item.urgency]} bg-white/[0.01] ${isBlurred ? 'select-none' : ''}`}
                    style={isBlurred ? { filter: `blur(${Math.min(3 + (i - 5) * 0.8, 6)}px)`, pointerEvents: 'none' } : undefined}>
                    <span className="text-2xl font-bold text-white/10 w-8 text-center flex-shrink-0">{i + 1}</span>
                    <span className="text-white text-sm flex-1 font-medium">{item.problem}</span>
                    <span className={`text-xs px-3 py-1 rounded-full flex-shrink-0 ${CATEGORY_STYLES[item.category] ?? 'bg-slate-500/10 text-slate-400'}`}>
                      {item.category}
                    </span>
                    <span className={`text-xs px-3 py-1 rounded-full border flex-shrink-0 font-medium ${URGENCY_STYLES[item.urgency]}`}>
                      {item.urgency}
                    </span>
                  </div>
                </FadeIn>
                )
              })}

              {/* Overlay CTA over blurred items — only if blur is active */}
              {(audit.improvements?.length ?? 0) > 5 && (audit.details as Record<string, unknown>)?.showAllImprovements !== true && (
                <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center justify-end pb-6 pt-28"
                  style={{ background: 'linear-gradient(to bottom, transparent, rgba(8,8,15,0.8) 35%, rgba(8,8,15,0.97))' }}>
                  <p className="text-white font-semibold text-lg mb-2">+{(audit.improvements?.length ?? 0) - 5} axes d&apos;amélioration identifiés</p>
                  <p className="text-slate-400 text-sm mb-5">Réservez un appel pour découvrir le plan d&apos;action complet</p>
                  <a href="https://calendly.com/contact-agence-kameo/30min" target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300 hover:scale-105 hover:opacity-90"
                    style={{ background: 'linear-gradient(135deg, #E14B89, #F8903C)' }}>
                    <Calendar size={16} />
                    Voir toutes les recommandations
                    <ArrowRight size={14} />
                  </a>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── Trustpilot Section ──────────────────────────────────────────────── */}
      <section className="py-6 px-6">
        <FadeIn>
          <div className="max-w-2xl mx-auto text-center">
            <a href="https://fr.trustpilot.com/review/agence-kameo.fr" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-4 bg-white/[0.03] border border-white/[0.08] rounded-2xl px-8 py-4 hover:bg-white/[0.06] transition-all duration-300 group">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} viewBox="0 0 24 24" className="w-5 h-5 text-[#00b67a] fill-current">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                ))}
              </div>
              <div className="text-left">
                <p className="text-white text-sm font-semibold">Noté Excellent sur Trustpilot</p>
                <p className="text-slate-500 text-xs">Voir les avis de nos clients</p>
              </div>
              <ExternalLink size={14} className="text-slate-600 group-hover:text-white transition-colors ml-2" />
            </a>
          </div>
        </FadeIn>
      </section>

      {/* ── CTA Section — hidden when blur disabled ────────────────────────── */}
      {(audit.details as Record<string, unknown>)?.showAllImprovements !== true && (
      <section className="py-28 px-6 relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(225,75,137,0.08) 0%, rgba(248,144,60,0.04) 35%, transparent 60%)' }} />

        <FadeIn>
          <div className="max-w-2xl mx-auto text-center relative z-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Prêt à améliorer votre site ?
            </h2>
            <p className="text-slate-400 text-lg mb-4">
              Discutons ensemble de votre projet et des solutions adaptées pour booster vos performances.
            </p>

            <p className="text-sm font-medium mb-8 flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full animate-pulse flex-shrink-0" style={{ background: 'linear-gradient(135deg, #E14B89, #F8903C)' }} />
              <span className="brand-gradient-text">Plus que quelques créneaux disponibles en {new Date().toLocaleDateString('fr-FR', { month: 'long' })}</span>
            </p>

            <a
              href="https://calendly.com/contact-agence-kameo/30min"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(225,75,137,0.3)] hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #E14B89, #F8903C)' }}
            >
              <Calendar size={22} />
              Réserver un appel de 30 min
              <ArrowRight size={18} />
            </a>

            <p className="text-slate-600 text-xs mt-6">Gratuit · Sans engagement · 30 minutes</p>
          </div>
        </FadeIn>
      </section>
      )}

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <footer className="py-10 px-6 border-t border-white/[0.04]">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Image src="/kameo-logo.svg" alt="Kameo" width={100} height={30} className="opacity-60" />
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <a href="https://agence-kameo.fr" target="_blank" rel="noopener noreferrer"
              className="hover:text-white transition-colors flex items-center gap-1">
              agence-kameo.fr <ExternalLink size={12} />
            </a>
            <a href="https://calendly.com/contact-agence-kameo/30min" target="_blank" rel="noopener noreferrer"
              className="hover:text-orange-400 transition-colors">
              Prendre rendez-vous
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
