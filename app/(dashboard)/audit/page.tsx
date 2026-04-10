'use client'

import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Search, Loader2, Smartphone, Monitor, Globe, ChevronDown, ChevronUp, Settings, FileText, Gauge, Tag, MonitorSmartphone, UserCheck, Check, ExternalLink, Mail, X, Send, Trash2, Shield } from 'lucide-react'
import { usePolling } from '@/hooks/usePolling'
import { AuditPremium } from '@/components/audit-premium'

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

interface AuditDetails {
  scores?: AuditScores
  logoUrl?: string
  cost?: number
  costDetails?: Record<string, unknown>
  descriptions?: {
    performance: string
    balises: string
    content: string
    responsive: string
    config: string
    ux: string
  }
}

interface Audit {
  id: string
  url: string
  performanceMobile?: number
  performanceDesktop?: number
  globalScore?: number
  technology?: string
  keywords?: string
  details?: AuditDetails
  improvements?: Improvement[]
  createdBy: { name: string }
  createdAt: string
}

interface Project { id: string; name: string; client: { name: string } }

const SCORE_COLOR = (score: number) =>
  score >= 75 ? 'text-[#95DB7D]' : score >= 50 ? 'text-[#FF9346]' : 'text-[#FF4040]'

const SCORE_BG = (score: number) =>
  score >= 75 ? 'bg-[#95DB7D]' : score >= 50 ? 'bg-[#FF9346]' : 'bg-[#FF4040]'

const URGENCY_COLORS: Record<string, string> = {
  Secondaire: 'bg-slate-800 text-slate-400',
  Important: 'bg-orange-500/15 text-[#FF9346]',
  Critique: 'bg-red-500/15 text-[#FF4040]',
}

const CATEGORY_COLORS: Record<string, string> = {
  Balises: 'bg-purple-500/15 text-purple-400',
  Contenu: 'bg-blue-500/15 text-blue-400',
  Responsive: 'bg-cyan-500/15 text-cyan-400',
  Performances: 'bg-amber-500/15 text-amber-400',
  UX: 'bg-pink-500/15 text-pink-400',
  Config: 'bg-slate-500/15 text-slate-400',
}

type CategoryKey = 'performance' | 'balises' | 'content' | 'responsive' | 'config' | 'ux'

const CATEGORIES: { key: CategoryKey; label: string; icon: typeof Gauge; brief: string; coeff: number }[] = [
  { key: 'balises', label: 'Balises', icon: Tag, brief: 'Balises title, meta description, titres Hn et données structurées', coeff: 2.5 },
  { key: 'content', label: 'Contenu', icon: FileText, brief: 'Qualité rédactionnelle, maillage interne et densité de mots-clés', coeff: 2.5 },
  { key: 'responsive', label: 'Responsive', icon: MonitorSmartphone, brief: 'Adaptation mobile, tablette et ergonomie tactile', coeff: 1.5 },
  { key: 'performance', label: 'Performances', icon: Gauge, brief: 'Vitesse de chargement, temps de réponse serveur et optimisation des ressources', coeff: 1.5 },
  { key: 'ux', label: 'Expérience utilisateur', icon: UserCheck, brief: 'Design, animations, CTA, navigation, hero section, footer et parcours utilisateur', coeff: 2.5 },
  { key: 'config', label: 'Configuration technique', icon: Settings, brief: 'HTTPS, sitemap, robots.txt, canonical et indexation Google', coeff: 1.5 },
]

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
            stroke={s >= 75 ? '#95DB7D' : s >= 50 ? '#FF9346' : '#FF4040'}
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

function CategoryCard({ catKey, score }: {
  catKey: CategoryKey
  score: number
}) {
  const cat = CATEGORIES.find(c => c.key === catKey)!
  const Icon = cat.icon

  return (
    <div className="bg-[#0d0d14] border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <Icon size={18} className="text-slate-400" />
          <span className="text-white font-semibold">{cat.label}</span>
          <span className="text-slate-600 text-xs">x{cat.coeff}</span>
        </div>
        <span className={`text-2xl font-bold ${SCORE_COLOR(score)}`}>{score}<span className="text-sm text-slate-500">/100</span></span>
      </div>
      <div className="w-full h-1.5 bg-slate-800 rounded-full mb-3">
        <div className={`h-full rounded-full transition-all ${SCORE_BG(score)}`} style={{ width: `${score}%` }} />
      </div>
      <p className="text-slate-500 text-xs leading-relaxed">{cat.brief}</p>
    </div>
  )
}

// ── Email Templates ──────────────────────────────────────────────────────────

const SENDERS = [
  { id: 'benjamin', label: 'Benjamin', email: 'benjamin.dayan@agence-kameo.fr', fullName: 'Benjamin Dayan', phone: '06 62 37 99 85', photo: 'https://ci3.googleusercontent.com/mail-sig/AIorK4y5n9HSQeH4H8BasIBGjo0sWc1iKi2vs3nYMGaeNhRUzXWlP3_PdnPcdfvbhjAWGRaoZeDJ5oUurubs' },
  { id: 'louison', label: 'Louison', email: 'louison.boutet@agence-kameo.fr', fullName: 'Louison Boutet', phone: '', photo: '' },
  { id: 'kameo', label: 'Kameo', email: 'contact@agence-kameo.fr', fullName: 'Agence Kameo', phone: '', photo: '' },
] as const

type SenderId = typeof SENDERS[number]['id']

function buildAuditEmailHtml({ firstName, formal, template, auditLink, siteUrl, senderId }: {
  firstName: string; formal: boolean; template: 'verena' | 'audit'; auditLink: string; siteUrl: string; senderId: SenderId
}) {
  const sender = SENDERS.find(s => s.id === senderId) || SENDERS[0]
  const vous = formal
  const greeting = `Bonjour ${firstName},`

  const bodyVerena = `
    <p style="margin: 0 0 24px 0; color: #444444; font-size: 16px; line-height: 1.7;">
      J'espère que ${vous ? 'vous allez' : 'tu vas'} bien.
    </p>
    <p style="margin: 0 0 24px 0; color: #444444; font-size: 16px; line-height: 1.7;">
      Nous nous étions croisés au pop-up de Verena en novembre.
    </p>
    <p style="margin: 0 0 24px 0; color: #444444; font-size: 16px; line-height: 1.7;">
      Nous avons repensé à notre discussion et à ${vous ? 'votre' : 'ton'} projet. On en a profité pour analyser ${vous ? 'votre' : 'ton'} site et ${vous ? 'vous' : 'te'} préparer un <strong style="color: #1a1a2e;">audit gratuit</strong> : performance, SEO, parcours client… On a identifié plusieurs points d'optimisation qui pourraient vraiment faire la différence.
    </p>
    <p style="margin: 0 0 24px 0; color: #444444; font-size: 16px; line-height: 1.7;">
      ${vous ? 'Vous trouverez' : 'Tu trouveras'} l'audit complet juste ici :
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 24px auto;">
      <tr>
        <td align="center" style="background: #f4f4f5; border-radius: 12px;">
          <a href="${auditLink}" target="_blank" style="display: inline-block; padding: 12px 28px; color: #1a1a2e; font-size: 14px; font-weight: 600; text-decoration: none;">
            📊 Voir l'audit complet
          </a>
        </td>
      </tr>
    </table>
    <p style="margin: 0 0 32px 0; color: #444444; font-size: 16px; line-height: 1.7;">
      Si ${vous ? 'vous souhaitez' : 'tu souhaites'} en savoir plus et être accompagné${vous ? '(e)' : '(e)'} par notre équipe à ce sujet, je ${vous ? 'vous' : 't\''} invite à réserver un créneau de 30 minutes.
    </p>`

  const bodyAudit = `
    <p style="margin: 0 0 24px 0; color: #444444; font-size: 16px; line-height: 1.7;">
      J'espère que ${vous ? 'vous allez' : 'tu vas'} bien.
    </p>
    <p style="margin: 0 0 24px 0; color: #444444; font-size: 16px; line-height: 1.7;">
      Nous avons analysé ${vous ? 'votre' : 'ton'} site <strong style="color: #1a1a2e;">${siteUrl}</strong> et nous ${vous ? 'vous' : 't\''} avons préparé un <strong style="color: #1a1a2e;">audit gratuit complet</strong> : performances, SEO, responsive, configuration technique, expérience utilisateur…
    </p>
    <p style="margin: 0 0 24px 0; color: #444444; font-size: 16px; line-height: 1.7;">
      Nous avons identifié plusieurs axes d'amélioration concrets qui pourraient avoir un vrai impact sur ${vous ? 'votre' : 'ton'} visibilité et ${vous ? 'vos' : 'tes'} conversions.
    </p>
    <p style="margin: 0 0 24px 0; color: #444444; font-size: 16px; line-height: 1.7;">
      ${vous ? 'Vous pouvez' : 'Tu peux'} consulter l'audit complet ici :
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 24px auto;">
      <tr>
        <td align="center" style="background: #f4f4f5; border-radius: 12px;">
          <a href="${auditLink}" target="_blank" style="display: inline-block; padding: 12px 28px; color: #1a1a2e; font-size: 14px; font-weight: 600; text-decoration: none;">
            📊 Voir l'audit complet
          </a>
        </td>
      </tr>
    </table>
    <p style="margin: 0 0 32px 0; color: #444444; font-size: 16px; line-height: 1.7;">
      Si ${vous ? 'vous souhaitez' : 'tu souhaites'} qu'on en discute ensemble et explorer les solutions adaptées, je ${vous ? 'vous' : 't\''} invite à réserver un créneau de 30 minutes — c'est gratuit et sans engagement.
    </p>`

  const bodyContent = template === 'verena' ? bodyVerena : bodyAudit

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
          <tr>
            <td style="background-color: #1a1a1a; padding: 40px 50px; text-align: center;">
              <img src="https://kameo-tool.vercel.app/kameo-logo.svg" alt="Kameo" style="max-width: 180px; height: auto;">
            </td>
          </tr>
          <tr>
            <td style="padding: 50px;">
              <p style="margin: 0 0 24px 0; color: #1a1a2e; font-size: 17px; line-height: 1.7;">
                ${greeting}
              </p>
              ${bodyContent}
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 32px auto;">
                <tr>
                  <td align="center" style="background: linear-gradient(135deg, #E14B89 0%, #F8903C 100%); border-radius: 50px;">
                    <a href="https://calendly.com/contact-agence-kameo/30min" target="_blank" style="display: inline-block; padding: 16px 40px; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; letter-spacing: 0.3px;">
                      Réserver mon créneau
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0; color: #444444; font-size: 16px; line-height: 1.7;">
                À bientôt,
              </p>
              <p style="margin: 8px 0 0 0; color: #1a1a2e; font-size: 17px; font-weight: 600;">
                ${sender.id === 'kameo' ? "L'équipe Kameo" : sender.fullName.split(' ')[0]}
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px 50px; border-top: 1px solid #eaeaea;">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  ${sender.photo ? `<td style="vertical-align: top; padding-right: 20px;">
                    <img src="${sender.photo}" alt="${sender.fullName}" style="width: 60px; height: 60px; border-radius: 50%;">
                  </td>` : ''}
                  <td style="vertical-align: middle;">
                    <p style="margin: 0 0 2px 0; color: #1a1a2e; font-size: 15px; font-weight: 600;">${sender.fullName}</p>
                    <p style="margin: 0 0 8px 0; color: #1a1a2e; font-size: 15px; font-weight: 400;">Agence Kameo</p>
                    ${sender.phone ? `<p style="margin: 0 0 2px 0; color: #666666; font-size: 14px;">${sender.phone}</p>` : ''}
                    <p style="margin: 0 0 2px 0;"><a href="mailto:${sender.email}" style="color: #E14B89; font-size: 14px; text-decoration: none;">${sender.email}</a></p>
                    <p style="margin: 0;"><a href="https://agence-kameo.fr" target="_blank" style="color: #E14B89; font-size: 14px; text-decoration: none;">agence-kameo.fr</a></p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ── Email Modal ──────────────────────────────────────────────────────────────

function EmailModal({ audit, onClose }: { audit: Audit; onClose: () => void }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [formal, setFormal] = useState(true)
  const [template, setTemplate] = useState<'verena' | 'audit'>('audit')
  const [senderId, setSenderId] = useState<SenderId>('benjamin')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const auditLink = typeof window !== 'undefined' ? `${window.location.origin}/rapport/${audit.id}` : ''

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setError(null)

    const sender = SENDERS.find(s => s.id === senderId) || SENDERS[0]
    const html = buildAuditEmailHtml({
      firstName,
      formal,
      template,
      auditLink,
      siteUrl: audit.url,
      senderId,
    })

    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email,
          subject: `Audit SEO de votre site — ${audit.url}`,
          rawHtml: html,
          replyTo: sender.email,
          senderName: sender.fullName,
          senderId,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Erreur lors de l'envoi")
      } else {
        setSent(true)
      }
    } catch {
      setError("Impossible d'envoyer l'email")
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-[#111118] border border-slate-800 rounded-2xl p-8 max-w-md w-full mx-4 text-center" onClick={e => e.stopPropagation()}>
          <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
            <Check size={28} className="text-green-400" />
          </div>
          <h3 className="text-white text-lg font-semibold mb-2">Email envoyé !</h3>
          <p className="text-slate-400 text-sm mb-6">L&apos;audit a été envoyé à {firstName} {lastName} ({email})</p>
          <button onClick={onClose} className="px-6 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm hover:bg-white/10 transition-colors">
            Fermer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-white font-semibold text-lg">Envoyer l&apos;audit par email</h3>
            <p className="text-slate-500 text-xs mt-0.5">{audit.url}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSend} className="space-y-4">
          {/* Prénom + Nom */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-xs mb-1.5 block">Prénom</label>
              <input value={firstName} onChange={e => setFirstName(e.target.value)} required placeholder="Roxane"
                className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#E14B89] transition-colors" />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1.5 block">Nom</label>
              <input value={lastName} onChange={e => setLastName(e.target.value)} required placeholder="Dupont"
                className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#E14B89] transition-colors" />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="text-slate-400 text-xs mb-1.5 block">Adresse email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="roxane@exemple.com"
              className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#E14B89] transition-colors" />
          </div>

          {/* Tutoiement / Vouvoiement */}
          <div>
            <label className="text-slate-400 text-xs mb-1.5 block">Ton du message</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setFormal(true)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${formal ? 'bg-[#E14B89]/15 border border-[#E14B89]/30 text-[#E14B89]' : 'bg-[#1a1a24] border border-slate-700 text-slate-400 hover:text-white'}`}>
                Vouvoiement
              </button>
              <button type="button" onClick={() => setFormal(false)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${!formal ? 'bg-[#E14B89]/15 border border-[#E14B89]/30 text-[#E14B89]' : 'bg-[#1a1a24] border border-slate-700 text-slate-400 hover:text-white'}`}>
                Tutoiement
              </button>
            </div>
          </div>

          {/* Template choice */}
          <div>
            <label className="text-slate-400 text-xs mb-1.5 block">Modèle d&apos;email</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setTemplate('verena')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-colors ${template === 'verena' ? 'bg-[#E14B89]/15 border border-[#E14B89]/30 text-[#E14B89]' : 'bg-[#1a1a24] border border-slate-700 text-slate-400 hover:text-white'}`}>
                Clients Verena
              </button>
              <button type="button" onClick={() => setTemplate('audit')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-colors ${template === 'audit' ? 'bg-[#E14B89]/15 border border-[#E14B89]/30 text-[#E14B89]' : 'bg-[#1a1a24] border border-slate-700 text-slate-400 hover:text-white'}`}>
                Audit général
              </button>
            </div>
            <p className="text-slate-600 text-xs mt-1.5">
              {template === 'verena'
                ? 'Mentionne la rencontre au pop-up Verena en novembre'
                : "Présentation générale de l'audit SEO réalisé"
              }
            </p>
          </div>

          {/* Expéditeur */}
          <div>
            <label className="text-slate-400 text-xs mb-1.5 block">Expéditeur</label>
            <div className="flex gap-2">
              {SENDERS.map(s => (
                <button key={s.id} type="button" onClick={() => setSenderId(s.id)}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2.5 ${senderId === s.id ? 'bg-[#E14B89]/15 border border-[#E14B89]/30 text-[#E14B89]' : 'bg-[#1a1a24] border border-slate-700 text-slate-400 hover:text-white'}`}>
                  {s.photo ? (
                    <img src={s.photo} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${senderId === s.id ? 'bg-[#E14B89]/30 text-[#E14B89]' : 'bg-slate-700 text-slate-400'}`}>
                      {s.label[0]}
                    </div>
                  )}
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={sending}
            className="w-full flex items-center justify-center gap-2 bg-[#E14B89] hover:opacity-90 disabled:opacity-50 text-white py-3 rounded-xl text-sm font-medium transition-colors">
            {sending ? <><Loader2 size={16} className="animate-spin" /> Envoi en cours...</> : <><Send size={16} /> Envoyer l&apos;email</>}
          </button>
        </form>
      </div>
    </div>
  )
}

function getScores(audit: Audit): AuditScores {
  if (audit.details?.scores) return audit.details.scores
  // Fallback for old audits
  const perf = Math.round(((audit.performanceMobile ?? 0) + (audit.performanceDesktop ?? 0)) / 2)
  return { performance: perf, balises: 0, content: 0, responsive: 0, config: 0, ux: 0 }
}

export default function AuditPage() {
  const { data: session } = useSession()
  const role = (session?.user as { role?: string })?.role ?? ''
  const isAdmin = role === 'ADMIN'
  const [auditTab, setAuditTab] = useState<'onsite' | 'complet'>('onsite')
  const [url, setUrl] = useState('')
  const [projectId, setProjectId] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [audits, setAudits] = useState<Audit[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [currentAudit, setCurrentAudit] = useState<Audit | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [auditError, setAuditError] = useState<string | null>(null)
  const [emailModalAudit, setEmailModalAudit] = useState<Audit | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/audit').then(r => r.json()),
      fetch('/api/projects').then(r => r.json()),
    ]).then(([a, p]) => { setAudits(a); setProjects(p) }).finally(() => setLoadingHistory(false))
  }, [])

  function refreshData() {
    Promise.all([
      fetch('/api/audit').then(r => r.json()),
      fetch('/api/projects').then(r => r.json()),
    ]).then(([a, p]) => { setAudits(a); setProjects(p) })
  }
  usePolling(refreshData)

  // URL suggestions from previous audits
  const urlSuggestions = url.length >= 2
    ? [...new Set(audits.map(a => a.url))].filter(u => u.toLowerCase().includes(url.toLowerCase()) && u !== url)
    : []

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleAudit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setCurrentAudit(null)
    setAuditError(null)
    setProgress(0)

    // Progress simulation: 0→90% over ~50s, accelerates then slows
    const steps = [
      { target: 15, duration: 3000 },  // PageSpeed init
      { target: 35, duration: 8000 },  // PageSpeed mobile
      { target: 55, duration: 8000 },  // PageSpeed desktop
      { target: 70, duration: 5000 },  // HTML analysis
      { target: 80, duration: 4000 },  // Technical checks
      { target: 90, duration: 12000 }, // AI generation
    ]
    let currentStep = 0
    let stepStart = Date.now()
    let prevTarget = 0

    progressRef.current = setInterval(() => {
      if (currentStep >= steps.length) return
      const step = steps[currentStep]
      const elapsed = Date.now() - stepStart
      const ratio = Math.min(elapsed / step.duration, 1)
      const eased = 1 - Math.pow(1 - ratio, 2) // ease-out
      const value = prevTarget + (step.target - prevTarget) * eased
      setProgress(Math.round(value))
      if (ratio >= 1) {
        prevTarget = step.target
        currentStep++
        stepStart = Date.now()
      }
    }, 100)

    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, projectId: projectId || null, keywords: null }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAuditError(data.error ?? "Erreur lors de l'audit")
      } else {
        setCurrentAudit(data)
        setAudits(prev => [data, ...prev])
      }
    } catch {
      setAuditError("Impossible de joindre l'API. Vérifiez l'URL et réessayez.")
    } finally {
      if (progressRef.current) clearInterval(progressRef.current)
      setProgress(100)
      setTimeout(() => setLoading(false), 300)
    }
  }


  async function handleDelete(id: string) {
    if (!confirm('Supprimer cet audit ?')) return
    setDeletingId(id)
    try {
      const res = await fetch('/api/audit', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setAudits(prev => prev.filter(a => a.id !== id))
        if (currentAudit?.id === id) setCurrentAudit(null)
        if (expandedId === id) setExpandedId(null)
      }
    } catch { /* ignore */ }
    setDeletingId(null)
  }

  const displayAudit = currentAudit

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Audit SEO</h1>
          <p className="text-slate-400 text-sm mt-1">
            {auditTab === 'onsite' ? 'Analyse performances, balises, contenu, responsive, technique et UX' : 'Étude de marché SEO complète avec données réelles'}
          </p>
        </div>
        {isAdmin && (
          <div className="flex bg-[#111118] border border-slate-800 rounded-xl p-0.5">
            <button onClick={() => setAuditTab('onsite')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${auditTab === 'onsite' ? 'bg-[#E14B89]/10 text-[#E14B89]' : 'text-slate-400 hover:text-white'}`}>
              <Search size={13} /> Audit on site
            </button>
            <button onClick={() => setAuditTab('complet')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${auditTab === 'complet' ? 'bg-gradient-to-r from-[#E14B89]/10 to-[#F8903C]/10 text-[#F8903C]' : 'text-slate-400 hover:text-white'}`}>
              <Shield size={13} /> Audit complet
            </button>
          </div>
        )}
      </div>

      {auditTab === 'complet' && isAdmin ? (
        <AuditPremium />
      ) : (
      <>
      {/* Form */}
      <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 mb-8">
        <form onSubmit={handleAudit} className="flex gap-3">
          <div className="flex-1 relative" ref={suggestionsRef}>
            <Globe size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 z-10" />
            <input value={url} onChange={e => { setUrl(e.target.value); setShowSuggestions(true) }}
              onFocus={() => setShowSuggestions(true)} required placeholder="https://exemple.com" autoComplete="off"
              className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#E14B89] transition-colors" />
            {showSuggestions && urlSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a24] border border-slate-700 rounded-xl overflow-hidden z-50 shadow-xl shadow-black/40">
                {urlSuggestions.slice(0, 6).map(s => (
                  <button key={s} type="button"
                    onClick={() => { setUrl(s); setShowSuggestions(false) }}
                    className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-2">
                    <Globe size={13} className="text-slate-600 flex-shrink-0" />
                    <span>{s}</span>
                  </button>
                ))}
              </div>
            )}
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

        {loading && (() => {
          const step = progress < 15 ? 'Initialisation...'
            : progress < 35 ? 'PageSpeed Mobile...'
            : progress < 55 ? 'PageSpeed Desktop...'
            : progress < 70 ? 'Analyse du site...'
            : progress < 80 ? 'Vérifications techniques...'
            : progress < 95 ? 'Génération IA...'
            : 'Finalisation...'
          const radius = 40
          const circumference = 2 * Math.PI * radius
          const dash = (progress / 100) * circumference
          const estimatedRemaining = progress < 90 ? Math.round((90 - progress) / 90 * 50) : progress < 100 ? '< 5' : 0

          return (
            <div className="mt-5 space-y-4">
              <div className="flex items-center gap-5 px-4 py-4 bg-[#0d0d14] border border-slate-800 rounded-xl">
                {/* Progress ring */}
                <div className="relative flex-shrink-0" style={{ width: 90, height: 90 }}>
                  <svg width={90} height={90} className="-rotate-90">
                    <circle cx={45} cy={45} r={radius} fill="none" stroke="#1e1e2e" strokeWidth={5} />
                    <circle cx={45} cy={45} r={radius} fill="none"
                      stroke="#E14B89" strokeWidth={5}
                      strokeDasharray={`${dash} ${circumference}`} strokeLinecap="round"
                      style={{ transition: 'stroke-dasharray 0.3s ease' }} />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-white font-bold text-lg">{progress}%</span>
                  </div>
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm mb-1">{step}</p>
                  <p className="text-slate-500 text-xs mb-2">
                    {estimatedRemaining ? `~${estimatedRemaining}s restantes` : 'Terminé'}
                  </p>
                  {/* Steps dots */}
                  <div className="flex items-center gap-1.5">
                    {['PageSpeed', 'HTML', 'Technique', 'IA'].map((s, i) => {
                      const thresholds = [35, 55, 80, 95]
                      const done = progress >= thresholds[i]
                      const active = i === 0 ? progress < 35 : progress >= [0, 35, 55, 80][i] && progress < thresholds[i]
                      return (
                        <div key={s} className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full transition-colors ${done ? 'bg-green-400' : active ? 'bg-[#E14B89] animate-pulse' : 'bg-slate-700'}`} />
                          <span className={`text-[10px] ${done ? 'text-green-400' : active ? 'text-white' : 'text-slate-600'}`}>{s}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

        {auditError && (
          <div className="mt-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {auditError}
          </div>
        )}
      </div>

      {/* Results */}
      {displayAudit && (() => {
        const scores = getScores(displayAudit)
        return (
          <div className="space-y-6 mb-10">

            {/* P1 — Informations techniques */}
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <div className="flex items-center gap-3">
                  {displayAudit.details?.logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={displayAudit.details.logoUrl} alt="" className="w-8 h-8 rounded-lg object-contain bg-white/10 flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  )}
                  <h2 className="text-white font-semibold text-lg">Résultats — {displayAudit.url}</h2>
                  </div>
                  <p className="text-slate-400 text-sm mt-0.5">Analyse complète multi-critères</p>
                </div>
                <div className="flex items-center gap-4">
                <a
                  href={`/rapport/${displayAudit.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E14B89]/10 border border-[#E14B89]/20 text-[#E14B89] text-sm hover:bg-[#E14B89]/20 transition-colors"
                >
                  <ExternalLink size={14} /> Voir l&apos;audit
                </a>
                <button
                  onClick={() => setEmailModalAudit(displayAudit)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-sm hover:bg-white/10 transition-colors"
                >
                  <Mail size={14} /> Envoyer par mail
                </button>
                <div className="text-center">
                  <div className={`text-4xl font-bold ${SCORE_COLOR(displayAudit.globalScore ?? 0)}`}>
                    {displayAudit.globalScore}/100
                  </div>
                  <p className="text-slate-400 text-xs mt-1">Score global · <span className="font-mono text-slate-600">{displayAudit.details?.cost ? `${displayAudit.details.cost.toFixed(3)} $` : '~0.50 $'}</span></p>
                </div>
              </div>
              </div>

              {displayAudit.technology && displayAudit.technology !== 'Non détecté' && displayAudit.technology !== 'Site custom / non détecté' && (
                <div className="mt-1">
                  <span className="inline-block px-4 py-1.5 rounded-full text-xs font-medium"
                    style={{ background: 'linear-gradient(135deg, rgba(225,75,137,0.1), rgba(248,144,60,0.1))', border: '1px solid rgba(225,75,137,0.2)' }}>
                    <span className="brand-gradient-text">{displayAudit.technology}</span>
                  </span>
                </div>
              )}
            </div>

            {/* P2 — 6 catégories scorées */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {CATEGORIES.map(cat => (
                <CategoryCard
                  key={cat.key}
                  catKey={cat.key}
                  score={scores[cat.key]}
                />
              ))}
            </div>

            {/* Score rings détail */}
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
              <p className="text-slate-300 font-medium text-sm mb-4">Détail des scores</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-4">
                <ScoreRing score={displayAudit.performanceMobile} label="Perf. Mobile" />
                <ScoreRing score={displayAudit.performanceDesktop} label="Perf. Desktop" />
                {CATEGORIES.map(cat => (
                  <ScoreRing key={cat.key} score={scores[cat.key]} label={cat.label} />
                ))}
              </div>

              {/* Calcul pondéré */}
              <div className="mt-5 bg-[#0d0d14] rounded-xl p-4 text-xs font-mono text-slate-400 border border-slate-800">
                <p className="text-slate-300 font-sans font-medium mb-2 text-sm">Calcul du score global (pondération Kameo)</p>
                {CATEGORIES.map(cat => (
                  <p key={cat.key}>{cat.label} (x{cat.coeff}) : {scores[cat.key]} x {cat.coeff} = <span className={SCORE_COLOR(scores[cat.key])}>{Math.round(scores[cat.key] * cat.coeff)}</span></p>
                ))}
                <p className="mt-2 pt-2 border-t border-slate-700 text-white">
                  Score = ({CATEGORIES.map(cat => Math.round(scores[cat.key] * cat.coeff)).join(' + ')}) / 10 = <span className={`font-bold ${SCORE_COLOR(displayAudit.globalScore ?? 0)}`}>{displayAudit.globalScore}/100</span>
                </p>
              </div>
            </div>

            {/* P4 — 8 axes d'amélioration */}
            {displayAudit.improvements && displayAudit.improvements.length > 0 && (
              <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
                <h2 className="text-white font-semibold mb-4">Axes d&apos;amélioration prioritaires</h2>
                <div className="space-y-2">
                  {(displayAudit.improvements as Improvement[]).map((item, i) => (
                    <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-[#0d0d14] border border-slate-800">
                      <span className="text-slate-500 text-xs font-mono w-5 text-center flex-shrink-0">{i + 1}</span>
                      <span className="text-white text-sm flex-1">{item.problem}</span>
                      <span className={`text-xs px-2.5 py-1 rounded-full flex-shrink-0 ${CATEGORY_COLORS[item.category] ?? 'bg-slate-500/15 text-slate-400'}`}>{item.category}</span>
                      <span className={`text-xs px-2.5 py-1 rounded-full flex-shrink-0 font-medium ${URGENCY_COLORS[item.urgency]}`}>{item.urgency}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* History */}
      <div>
        <h2 className="text-white font-semibold mb-4">Historique des audits</h2>
        {loadingHistory ? (
          <div className="text-slate-500 text-sm">Chargement...</div>
        ) : audits.filter(a => a.id !== displayAudit?.id).length === 0 ? (
          <p className="text-slate-500 text-sm">Aucun audit précédent</p>
        ) : (
          <div className="space-y-3">
            {audits.filter(a => a.id !== displayAudit?.id).map(audit => {
              const scores = getScores(audit)
              return (
                <div key={audit.id} className="bg-[#111118] border border-slate-800 rounded-2xl overflow-hidden">
                  <button onClick={() => setExpandedId(expandedId === audit.id ? null : audit.id)}
                    className="w-full flex items-center gap-4 p-4 hover:bg-slate-800/20 transition-colors">
                    {audit.details?.logoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={audit.details.logoUrl} alt="" className="w-7 h-7 rounded-lg object-contain bg-white/10 flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    )}
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2.5">
                        <p className="text-white text-sm font-medium">{audit.url}</p>
                        {audit.technology && audit.technology !== 'Non détecté' && audit.technology !== 'Site custom / non détecté' && (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-medium"
                            style={{ background: 'linear-gradient(135deg, rgba(225,75,137,0.1), rgba(248,144,60,0.1))', border: '1px solid rgba(225,75,137,0.2)' }}>
                            <span className="brand-gradient-text">{audit.technology}</span>
                          </span>
                        )}
                      </div>
                      <p className="text-slate-500 text-xs mt-0.5">
                        par {audit.createdBy.name} · {new Date(audit.createdAt).toLocaleDateString('fr-FR')}
                      </p>
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
                      <span className="text-slate-600 text-[10px] font-mono">{audit.details?.cost ? `${audit.details.cost.toFixed(3)} $` : '~0.50 $'}</span>
                      <div className={`text-xl font-bold ${SCORE_COLOR(audit.globalScore ?? 0)}`}>{audit.globalScore}</div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setCurrentAudit(audit); setExpandedId(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-[#E14B89] hover:bg-[#E14B89]/10 transition-colors"
                        title="Rouvrir cet audit"
                      >
                        <ExternalLink size={14} />
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          const d = (audit.details || {}) as Record<string, unknown>
                          const newVal = !d.showAllImprovements
                          await fetch(`/api/audit`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: audit.id, details: { ...d, showAllImprovements: newVal } }) })
                          setAudits(prev => prev.map(a => a.id === audit.id ? { ...a, details: { ...d, showAllImprovements: newVal } as AuditDetails } : a))
                        }}
                        className={`p-1.5 rounded-lg transition-colors text-[10px] ${(audit.details as Record<string, unknown>)?.showAllImprovements ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-600 hover:text-amber-400 hover:bg-amber-500/10'}`}
                        title={(audit.details as Record<string, unknown>)?.showAllImprovements ? 'Masquer les axes (flou actif)' : 'Afficher tous les axes (flou desactive)'}
                      >
                        {(audit.details as Record<string, unknown>)?.showAllImprovements ? '🔓' : '🔒'}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(audit.id) }}
                        disabled={deletingId === audit.id}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        title="Supprimer"
                      >
                        {deletingId === audit.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                      {expandedId === audit.id ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                    </div>
                  </button>

                  {expandedId === audit.id && (
                    <div className="px-4 pb-4 border-t border-slate-800 pt-4 space-y-4">
                      {audit.technology && audit.technology !== 'Non détecté' && audit.technology !== 'Site custom / non détecté' && (
                        <div>
                          <span className="inline-block px-3 py-1 rounded-full text-xs font-medium"
                            style={{ background: 'linear-gradient(135deg, rgba(225,75,137,0.1), rgba(248,144,60,0.1))', border: '1px solid rgba(225,75,137,0.2)' }}>
                            <span className="brand-gradient-text">{audit.technology}</span>
                          </span>
                        </div>
                      )}

                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {CATEGORIES.map(cat => (
                          <div key={cat.key} className="bg-[#0d0d14] rounded-lg p-2.5 text-center">
                            <div className={`text-lg font-bold ${SCORE_COLOR(scores[cat.key])}`}>{scores[cat.key]}</div>
                            <div className="text-slate-500 text-xs">{cat.label}</div>
                          </div>
                        ))}
                      </div>

                      {audit.improvements && (audit.improvements as Improvement[]).length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Axes d&apos;amélioration</p>
                          {(audit.improvements as Improvement[]).map((item, i) => (
                            <div key={i} className="flex items-center gap-3 text-sm">
                              <span className="text-slate-600 text-xs font-mono w-4">{i + 1}</span>
                              <span className="text-slate-300 flex-1">{item.problem}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[item.category] ?? 'bg-slate-500/15 text-slate-400'}`}>{item.category}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${URGENCY_COLORS[item.urgency]}`}>{item.urgency}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Email Modal */}
      {emailModalAudit && (
        <EmailModal audit={emailModalAudit} onClose={() => setEmailModalAudit(null)} />
      )}
      </>
      )}
    </div>
  )
}
