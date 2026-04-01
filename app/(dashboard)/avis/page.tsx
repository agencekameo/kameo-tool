'use client'

import { useEffect, useState } from 'react'
import { usePolling } from '@/hooks/usePolling'
import { Star, StarOff, CheckCircle2, Clock, XCircle, Plus, X, Send, Trash2, Mail, Loader2, Search } from 'lucide-react'

interface Review {
  id: string
  clientName: string
  status: string // RECU, EN_ATTENTE, A_DEMANDER, HORS_CATEGORIE
  clientEmail: string | null
  contactName: string | null
  companyName: string | null
  createdAt: string
}

interface Client {
  id: string
  name: string
  company: string | null
}

type FilterTab = 'all' | 'RECU' | 'EN_ATTENTE' | 'A_DEMANDER' | 'HORS_CATEGORIE'

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle2; bg: string; text: string; border: string }> = {
  RECU: { label: 'Avis reçu', icon: CheckCircle2, bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  EN_ATTENTE: { label: 'En attente', icon: Clock, bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  A_DEMANDER: { label: 'À demander', icon: Send, bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
  HORS_CATEGORIE: { label: 'Hors catégorie', icon: XCircle, bg: 'bg-slate-700/50', text: 'text-slate-400', border: 'border-slate-600/30' },
}

const STATUS_CYCLE = ['A_DEMANDER', 'EN_ATTENTE', 'RECU', 'HORS_CATEGORIE']

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

const REVIEW_EMAIL_HTML = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Votre avis compte pour nous</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f4f4f4;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <tr>
                        <td style="background-color: #ffffff; padding: 35px 40px; text-align: center; border-bottom: 1px solid #eeeeee;">
                            <img src="https://nexus-games.com/wp-content/uploads/2026/02/KAMEO-LOGO.png" alt="Agence Kameo" style="max-width: 160px; height: auto;" />
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #00b67a; padding: 15px 40px; text-align: center;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                                <tr>
                                    <td style="vertical-align: middle; padding-right: 12px;">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle;">
                                            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="white"/>
                                        </svg>
                                    </td>
                                    <td style="vertical-align: middle;">
                                        <span style="color: #ffffff; font-size: 14px; font-weight: 600; letter-spacing: 0.5px;">RAPPEL AUTOMATIQUE • TRUSTPILOT</span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin-bottom: 25px;">
                                <tr>
                                    <td style="background-color: #fff3e0; border-radius: 50%; padding: 15px;">
                                        <span style="font-size: 32px;">🔔</span>
                                    </td>
                                </tr>
                            </table>
                            <h1 style="margin: 0 0 20px 0; color: #1a1a2e; font-size: 24px; font-weight: 700; text-align: center; line-height: 1.3;">
                                Nous n'avons pas encore reçu votre avis
                            </h1>
                            <p style="margin: 0 0 20px 0; color: #555555; font-size: 16px; line-height: 1.6; text-align: center;">
                                Suite à notre collaboration, nous vous avions invité à partager votre expérience. Votre retour n'a pas encore été enregistré sur Trustpilot.
                            </p>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8f9fa; border-radius: 8px; margin: 25px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.6; text-align: center;">
                                            <strong style="color: #1a1a2e;">Pourquoi votre avis est important ?</strong><br><br>
                                            Il aide d'autres entreprises à faire le bon choix et nous permet d'améliorer continuellement nos services.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 0 0 30px 0; color: #888888; font-size: 14px; text-align: center;">
                                ⏱️ Temps estimé : <strong style="color: #1a1a2e;">moins de 2 minutes</strong>
                            </p>
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                                <tr>
                                    <td style="border-radius: 8px; background-color: #00b67a;">
                                        <a href="https://fr.trustpilot.com/evaluate/agence-kameo.fr" target="_blank" style="display: inline-block; padding: 16px 40px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">
                                            ⭐ Laisser mon avis sur Trustpilot
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin-top: 25px;">
                                <tr>
                                    <td style="text-align: center; background-color: #00b67a; padding: 10px 20px; border-radius: 6px;">
                                        <img src="https://cdn.trustpilot.net/brand-assets/4.3.0/logo-white.svg" alt="Trustpilot" style="height: 24px; width: auto;" />
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0 40px;">
                            <hr style="border: none; border-top: 1px solid #eeeeee; margin: 0;" />
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 30px 40px;">
                            <p style="margin: 0 0 20px 0; color: #1a1a2e; font-size: 14px; font-weight: 600; text-align: center;">
                                Comment laisser un avis ?
                            </p>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td width="33%" style="text-align: center; padding: 10px;">
                                        <div style="background-color: #e8f5e9; border-radius: 50%; width: 40px; height: 40px; line-height: 40px; margin: 0 auto 10px auto; font-weight: 700; color: #00b67a;">1</div>
                                        <p style="margin: 0; color: #666666; font-size: 12px;">Cliquez sur le bouton</p>
                                    </td>
                                    <td width="33%" style="text-align: center; padding: 10px;">
                                        <div style="background-color: #e8f5e9; border-radius: 50%; width: 40px; height: 40px; line-height: 40px; margin: 0 auto 10px auto; font-weight: 700; color: #00b67a;">2</div>
                                        <p style="margin: 0; color: #666666; font-size: 12px;">Notez votre expérience</p>
                                    </td>
                                    <td width="33%" style="text-align: center; padding: 10px;">
                                        <div style="background-color: #e8f5e9; border-radius: 50%; width: 40px; height: 40px; line-height: 40px; margin: 0 auto 10px auto; font-weight: 700; color: #00b67a;">3</div>
                                        <p style="margin: 0; color: #666666; font-size: 12px;">Partagez en quelques mots</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #1a1a2e; padding: 30px 40px; text-align: center;">
                            <p style="margin: 0 0 15px 0; color: #ffffff; font-size: 14px; font-weight: 600;">Agence Kameo</p>
                            <p style="margin: 0 0 15px 0; color: #aaaaaa; font-size: 12px; line-height: 1.6;">Votre partenaire digital à Toulouse<br>Web • SEO • Réseaux sociaux</p>
                            <p style="margin: 0; color: #666666; font-size: 11px;">
                                <a href="https://agence-kameo.fr" style="color: #00b67a; text-decoration: none;">agence-kameo.fr</a>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 20px 40px; text-align: center; background-color: #f8f9fa;">
                            <p style="margin: 0; color: #999999; font-size: 10px; line-height: 1.5;">
                                Ceci est un email automatique envoyé aux clients n'ayant pas encore laissé d'avis.<br>
                                Si vous avez déjà partagé votre expérience, veuillez ignorer ce message.<br><br>
                                <a href="#" style="color: #999999; text-decoration: underline;">Se désinscrire</a> •
                                <a href="https://agence-kameo.fr/mentions-legales" style="color: #999999; text-decoration: underline;">Mentions légales</a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`

export default function AvisPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [toggling, setToggling] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newStatus, setNewStatus] = useState('A_DEMANDER')
  const [clients, setClients] = useState<Client[]>([])
  const [clientSearch, setClientSearch] = useState('')
  const [showClientDropdown, setShowClientDropdown] = useState(false)

  useEffect(() => {
    fetch('/api/reviews').then(r => r.json()).then(setReviews).finally(() => setLoading(false))
    fetch('/api/clients').then(r => r.json()).then(setClients).catch(() => {})
  }, [])

  function refreshData() {
    fetch('/api/reviews').then(r => r.json()).then(setReviews).catch(() => {})
  }
  usePolling(refreshData)

  const recuCount = reviews.filter(r => r.status === 'RECU').length
  const attenteCount = reviews.filter(r => r.status === 'EN_ATTENTE').length
  const demanderCount = reviews.filter(r => r.status === 'A_DEMANDER').length
  const horsCount = reviews.filter(r => r.status === 'HORS_CATEGORIE').length
  const denominator = reviews.length - horsCount
  const receivedPercent = denominator > 0 ? Math.round((recuCount / denominator) * 100) : 0

  const filtered = activeTab === 'all' ? reviews : reviews.filter(r => r.status === activeTab)

  async function cycleStatus(review: Review) {
    if (toggling) return
    setToggling(review.id)
    const currentIdx = STATUS_CYCLE.indexOf(review.status)
    const nextStatus = STATUS_CYCLE[(currentIdx + 1) % STATUS_CYCLE.length]

    setReviews(prev => prev.map(r => r.id === review.id ? { ...r, status: nextStatus } : r))
    try {
      const res = await fetch(`/api/reviews/${review.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!res.ok) setReviews(prev => prev.map(r => r.id === review.id ? { ...r, status: review.status } : r))
    } catch {
      setReviews(prev => prev.map(r => r.id === review.id ? { ...r, status: review.status } : r))
    } finally { setToggling(null) }
  }

  async function handleAdd() {
    if (!newName.trim()) return
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientName: newName.trim(), status: newStatus }),
      })
      if (res.ok) {
        const created = await res.json()
        setReviews(prev => {
          const exists = prev.find(r => r.id === created.id)
          if (exists) return prev.map(r => r.id === created.id ? created : r)
          return [...prev, created].sort((a, b) => a.clientName.localeCompare(b.clientName))
        })
        setNewName('')
        setClientSearch('')
        setNewStatus('A_DEMANDER')
        setShowAdd(false)
      }
    } catch { alert('Erreur') }
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cet avis ?')) return
    await fetch(`/api/reviews/${id}`, { method: 'DELETE' })
    setReviews(prev => prev.filter(r => r.id !== id))
  }

  const [sendingEmail, setSendingEmail] = useState<string | null>(null)
  const [emailConfirm, setEmailConfirm] = useState<Review | null>(null)

  function handleSendEmail(review: Review) {
    if (!review.clientEmail) {
      alert('Aucun email trouvé pour ce client')
      return
    }
    setEmailConfirm(review)
  }

  async function confirmSendEmail() {
    const review = emailConfirm
    if (!review || !review.clientEmail) return
    setEmailConfirm(null)
    setSendingEmail(review.id)
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: review.clientEmail,
          subject: 'Votre avis compte pour nous — Agence Kameo',
          rawHtml: REVIEW_EMAIL_HTML,
          senderName: 'Agence Kameo',
          senderId: 'kameo',
        }),
      })
      if (res.ok) {
        if (review.status === 'A_DEMANDER') {
          setReviews(prev => prev.map(r => r.id === review.id ? { ...r, status: 'EN_ATTENTE' } : r))
          await fetch(`/api/reviews/${review.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'EN_ATTENTE' }),
          })
        }
      } else {
        const data = await res.json()
        alert(data.error || 'Erreur lors de l\'envoi')
      }
    } catch { alert('Erreur réseau') }
    finally { setSendingEmail(null) }
  }

  const TABS: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'Tous', count: reviews.length },
    { key: 'RECU', label: 'Avis reçu', count: recuCount },
    { key: 'EN_ATTENTE', label: 'En attente', count: attenteCount },
    { key: 'A_DEMANDER', label: 'À demander', count: demanderCount },
    { key: 'HORS_CATEGORIE', label: 'Hors catégorie', count: horsCount },
  ]

  return (
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <Star size={18} className="text-amber-400" />
            </div>
            <h1 className="text-2xl font-semibold text-white">Avis Google</h1>
          </div>
          <p className="text-slate-400 text-sm mt-1 ml-12">
            Suivi des avis Google pour les clients en maintenance
          </p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
          <Plus size={16} /> Ajouter
        </button>
      </div>

      {/* Summary bar */}
      <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5 mb-6">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
              <Star size={16} className="text-slate-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{reviews.length}</p>
              <p className="text-slate-500 text-xs">clients</p>
            </div>
          </div>

          <div className="h-10 w-px bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 size={16} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-400">{recuCount}</p>
              <p className="text-slate-500 text-xs">avis reçus</p>
            </div>
          </div>

          <div className="h-10 w-px bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Clock size={16} className="text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-400">{attenteCount}</p>
              <p className="text-slate-500 text-xs">en attente</p>
            </div>
          </div>

          <div className="h-10 w-px bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Send size={16} className="text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-400">{demanderCount}</p>
              <p className="text-slate-500 text-xs">à demander</p>
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
                  background: receivedPercent >= 70
                    ? 'linear-gradient(90deg, #10b981, #34d399)'
                    : receivedPercent >= 40
                    ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
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
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === tab.key ? 'bg-[#E14B89] text-white' : 'text-slate-400 hover:text-white'
            }`}>
            {tab.label}
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
              activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-500'
            }`}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Review list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 bg-[#111118] border border-slate-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/60 flex items-center justify-center mb-4">
            <StarOff size={28} className="text-slate-600" />
          </div>
          <p className="text-slate-400 font-medium">Aucun avis trouvé</p>
          <p className="text-slate-600 text-sm mt-1">Essayez un autre filtre</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(review => {
            const displayName = review.companyName || review.clientName
            const initial = displayName[0].toUpperCase()
            const gradient = getGradient(displayName)
            const config = STATUS_CONFIG[review.status] || STATUS_CONFIG.A_DEMANDER

            return (
              <div key={review.id}
                className="flex items-center gap-4 bg-[#111118] border border-slate-800 rounded-2xl px-5 py-3.5 hover:border-slate-700 transition-colors group">
                {/* Avatar */}
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                  <span className="text-white font-bold text-sm">{initial}</span>
                </div>

                {/* Company name + contact */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">{displayName}</p>
                  {review.contactName && (
                    <p className="text-slate-500 text-xs truncate">{review.contactName}</p>
                  )}
                </div>

                {/* Status button */}
                <button onClick={() => cycleStatus(review)} disabled={toggling === review.id}
                  className={`${config.bg} hover:opacity-80 ${config.text} px-3.5 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-60 cursor-pointer`}>
                  {config.label}
                </button>

                {/* Email */}
                {(review.status === 'A_DEMANDER' || review.status === 'EN_ATTENTE') && (
                  <button onClick={() => handleSendEmail(review)} disabled={sendingEmail === review.id}
                    title={review.clientEmail ? `Envoyer à ${review.clientEmail}` : 'Aucun email'}
                    className={`p-1.5 transition-colors ${review.clientEmail ? 'text-slate-500 hover:text-[#00b67a]' : 'text-slate-700 cursor-not-allowed'} disabled:opacity-60`}>
                    {sendingEmail === review.id ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                  </button>
                )}

                {/* Delete */}
                <button onClick={() => handleDelete(review.id)}
                  className="p-1.5 text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Footer note */}
      {!loading && reviews.length > 0 && (
        <p className="text-slate-600 text-xs text-center mt-8">
          Cliquez sur le statut pour le modifier : À demander → En attente → Avis reçu → Hors catégorie
        </p>
      )}

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold text-lg">Ajouter un avis</h2>
              <button onClick={() => { setShowAdd(false); setClientSearch(''); setNewName('') }} className="text-slate-500 hover:text-white p-1"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Client *</label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    value={clientSearch}
                    onChange={e => { setClientSearch(e.target.value); setShowClientDropdown(true); if (!e.target.value) setNewName('') }}
                    onFocus={() => setShowClientDropdown(true)}
                    onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                    placeholder="Rechercher un client..."
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl pl-9 pr-8 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                  />
                  {newName && (
                    <button type="button" onClick={() => { setNewName(''); setClientSearch('') }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                      <X size={14} />
                    </button>
                  )}
                  {showClientDropdown && (
                    <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-[#1a1a24] border border-slate-700 rounded-xl max-h-40 overflow-y-auto shadow-lg">
                      {clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()) || (c.company && c.company.toLowerCase().includes(clientSearch.toLowerCase()))).map(c => (
                        <button key={c.id} type="button"
                          onMouseDown={() => { setNewName(c.name); setClientSearch(c.company ? `${c.company} (${c.name})` : c.name); setShowClientDropdown(false) }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-800 transition-colors first:rounded-t-xl last:rounded-b-xl ${newName === c.name ? 'text-[#E14B89]' : 'text-slate-300'}`}>
                          {c.company ? `${c.company} (${c.name})` : c.name}
                        </button>
                      ))}
                      {clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()) || (c.company && c.company.toLowerCase().includes(clientSearch.toLowerCase()))).length === 0 && (
                        <p className="px-3 py-2 text-slate-500 text-xs">Aucun client trouvé</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Statut</label>
                <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                  {Object.entries(STATUS_CONFIG).map(([key, { label }]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => { setShowAdd(false); setClientSearch(''); setNewName('') }}
                  className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors">Annuler</button>
                <button onClick={handleAdd} disabled={!newName.trim()}
                  className="flex-1 bg-[#E14B89] hover:opacity-90 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
                  Ajouter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email confirmation modal */}
      {emailConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold text-lg">Confirmer l&apos;envoi</h2>
              <button onClick={() => setEmailConfirm(null)} className="text-slate-500 hover:text-white p-1"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div className="bg-[#1a1a24] border border-slate-700 rounded-xl p-4">
                <p className="text-slate-400 text-xs mb-1">Client</p>
                <p className="text-white font-medium text-sm">{emailConfirm.clientName}</p>
              </div>
              <div className="bg-[#1a1a24] border border-slate-700 rounded-xl p-4">
                <p className="text-slate-400 text-xs mb-1">Email destinataire</p>
                <p className="text-white font-medium text-sm">{emailConfirm.clientEmail}</p>
              </div>
              <div className="bg-[#00b67a]/10 border border-[#00b67a]/30 rounded-xl p-4">
                <p className="text-[#00b67a] text-xs font-semibold mb-1">Objet du mail</p>
                <p className="text-slate-300 text-sm">Demande d&apos;avis Trustpilot — Agence Kameo</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEmailConfirm(null)}
                  className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors">Annuler</button>
                <button onClick={confirmSendEmail}
                  className="flex-1 bg-[#00b67a] hover:opacity-90 text-white py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2">
                  <Send size={14} /> Envoyer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
