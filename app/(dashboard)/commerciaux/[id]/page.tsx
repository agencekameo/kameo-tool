'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { usePolling } from '@/hooks/usePolling'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Trash2, Pencil, Phone, Mail, Users2, Play, FileText,
  Euro, Upload, Check, X, ChevronDown, Loader2, Briefcase, Calendar,
  DollarSign, CheckCircle2, AlertTriangle, Globe, ExternalLink, Eye,
  Send, Search, Clock,
} from 'lucide-react'
import { formatCurrency, formatDate, formatPhone, ROLE_AVATAR_COLORS } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Prospect {
  id: string; name: string; firstName?: string; lastName?: string; company?: string; email?: string; phone?: string
  website?: string; googleUrl?: string
  status: string; budget?: number; source?: string; notes?: string; assignedTo?: string
  leadSearchId?: string | null
  callbackDate?: string | null
  statusHistory?: string[]
  updatedAt?: string
}

interface Relance {
  id: string; prospectId: string; userId: string; type: string; date: string
  notes?: string; done: boolean; prospect: { name: string; company?: string }
}

interface Video {
  id: string; title: string; url: string; description?: string; category?: string
}

interface Speech {
  id: string; userId: string; title: string; content: string; updatedAt: string
}

interface Commission {
  id: string; userId: string; prospectId?: string; amount: number; type: string
  date: string; notes?: string; paid: boolean; prospect?: { name: string }
}

interface UserInfo {
  id: string; name: string; email: string; role: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type Tab = 'leads' | 'stats' | 'videos' | 'speech' | 'commissions' | 'plaquette'

const TABS: { key: Tab; label: string }[] = [
  { key: 'leads', label: 'Leads' },
  { key: 'stats', label: 'Statistiques' },
  { key: 'videos', label: 'Videos' },
  { key: 'speech', label: 'Speech' },
  { key: 'plaquette', label: 'Plaquette' },
  { key: 'commissions', label: 'Commissions' },
]

const LEAD_LOCATIONS = ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Bordeaux', 'Lille', 'Nantes', 'Strasbourg', 'Nice', 'Rennes', 'Montpellier', 'France']

const STATUS_LABELS: Record<string, string> = {
  A_CONTACTER: 'A contacter',
  PAS_REPONDU: 'Pas répondu',
  A_RAPPELER: 'A rappeler',
  MAIL_ENVOYE: 'Mail envoyé',
  VISIO_PLANIFIE: 'Visio planifiée',
  DEVIS_TRANSMETTRE: 'Devis à transmettre',
  DEVIS_ENVOYE: 'Devis envoyé',
  A_RELANCER: 'A relancer',
  REFUSE: 'Refusé',
  SIGNE: 'Signé',
}

const STATUS_COLORS: Record<string, string> = {
  A_CONTACTER: 'bg-slate-500/15 text-slate-400',
  PAS_REPONDU: 'bg-yellow-500/15 text-yellow-400',
  A_RAPPELER: 'bg-orange-500/15 text-orange-400',
  MAIL_ENVOYE: 'bg-teal-500/15 text-teal-400',
  VISIO_PLANIFIE: 'bg-indigo-500/15 text-indigo-400',
  DEVIS_TRANSMETTRE: 'bg-blue-500/15 text-blue-400',
  DEVIS_ENVOYE: 'bg-orange-500/15 text-orange-400',
  A_RELANCER: 'bg-amber-500/15 text-amber-400',
  REFUSE: 'bg-red-500/15 text-red-400',
  SIGNE: 'bg-green-500/15 text-green-400',
}

const RELANCE_TYPE_CONFIG: Record<string, { label: string; icon: typeof Phone; color: string }> = {
  APPEL: { label: 'Appel', icon: Phone, color: 'bg-blue-500/15 text-blue-400' },
  EMAIL: { label: 'Email', icon: Mail, color: 'bg-green-500/15 text-green-400' },
  REUNION: { label: 'Reunion', icon: Users2, color: 'bg-purple-500/15 text-purple-400' },
}

const COMMISSION_TYPE_LABELS: Record<string, string> = {
  SIGNATURE: 'Signature',
  BONUS: 'Bonus',
  PARRAINAGE: 'Parrainage',
}

const COMMISSION_TYPE_COLORS: Record<string, string> = {
  SIGNATURE: 'bg-emerald-500/15 text-emerald-400',
  BONUS: 'bg-amber-500/15 text-amber-400',
  PARRAINAGE: 'bg-purple-500/15 text-purple-400',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\s]{11})/)
  return m ? m[1] : null
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// ---------------------------------------------------------------------------
// Shared input class
// ---------------------------------------------------------------------------

const inputClass =
  'w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors'
const selectClass = inputClass
const textareaClass = inputClass + ' resize-none'
const labelClass = 'block text-slate-400 text-xs mb-1.5'

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function CommercialDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: session } = useSession()
  const isAdmin = (session?.user as { role?: string })?.role === 'ADMIN'

  // ---- State ----
  const [user, setUser] = useState<UserInfo | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('leads')
  const [loading, setLoading] = useState(true)

  // Leads
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [leadFilter, setLeadFilter] = useState<string>('A_CONTACTER')
  const [showLeadModal, setShowLeadModal] = useState(false)
  const [editLead, setEditLead] = useState<Prospect | null>(null)
  const [leadForm, setLeadForm] = useState({ firstName: '', lastName: '', company: '', email: '', phone: '', budget: '', source: '', notes: '' })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [statusDropdownId, setStatusDropdownId] = useState<string | null>(null)
  const statusDropdownRef = useRef<HTMLDivElement>(null)
  const [leadSearchQuery, setLeadSearchQuery] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Callback modal (A_RAPPELER)
  const [showCallbackModal, setShowCallbackModal] = useState(false)
  const [callbackLeadId, setCallbackLeadId] = useState<string | null>(null)
  const [callbackDate, setCallbackDate] = useState('')
  const [callbackTime, setCallbackTime] = useState('')
  const [callbackNotes, setCallbackNotes] = useState('')

  // List filter (checkboxes)
  const [selectedLists, setSelectedLists] = useState<Set<string>>(new Set(['all']))
  const [showListFilter, setShowListFilter] = useState(false)
  const listFilterRef = useRef<HTMLDivElement>(null)

  // Email modal
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailTarget, setEmailTarget] = useState<Prospect | null>(null)
  const [emailForm, setEmailForm] = useState({ senderId: 'jonathan', senderName: 'Jonathan Derai', subject: '', rawHtml: '', bodyContent: '', scheduled: false, scheduledDate: '', scheduledTime: '' })
  const emailBodyRef = useRef<HTMLDivElement>(null)
  const [emailCivilite, setEmailCivilite] = useState<'M.' | 'Mme'>('M.')
  const [emailContactLastName, setEmailContactLastName] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailTemplateId, setEmailTemplateId] = useState<string | null>(null)

  const SENDER_ACCOUNTS = [
    { id: 'benjamin', label: 'Benjamin Dayan' },
    { id: 'jonathan', label: 'Jonathan Derai (derai.jonathan@agence-kameo.fr)' },
    { id: 'louison', label: 'Louison Boutet' },
  ]

  // Signatures loaded from API (synced with Paramètres > Signatures)
  interface EmailSignature { id: string; name: string; fullName: string; role: string; company: string; phone: string; email: string; website: string; photoUrl: string; logoUrl: string }
  const [emailSignatures, setEmailSignatures] = useState<EmailSignature[]>([])
  useEffect(() => {
    fetch('/api/settings?key=email_signatures').then(r => r.json()).then(data => {
      if (data.value) try { setEmailSignatures(JSON.parse(data.value)) } catch { /* */ }
    }).catch(() => { /* */ })
  }, [])

  function signatureToHtml(sig: EmailSignature) {
    const baseUrl = 'https://kameo-tool.vercel.app'
    return `<table cellpadding="0" cellspacing="0" style="margin-top:28px;border-top:1px solid #eee;padding-top:24px;">
<tr>
<td style="padding-right:40px;vertical-align:top;width:90px;">
<img src="${baseUrl}${sig.photoUrl}" alt="${sig.fullName}" width="56" height="56" style="border-radius:50%;display:block;width:56px;height:56px;object-fit:cover;" />
<div style="height:20px;"></div>
<img src="${baseUrl}${sig.logoUrl}" alt="${sig.company}" width="80" style="border-radius:8px;display:block;width:80px;object-fit:contain;" />
</td>
<td style="vertical-align:top;padding-left:16px;">
<p style="margin:0;font-size:14px;font-weight:600;color:#1a1a2e;">${sig.fullName}</p>
<p style="margin:3px 0 0;font-size:12px;color:#888;">${sig.role}</p>
<p style="margin:3px 0 0;font-size:12px;color:#888;">${sig.company}</p>
<p style="margin:14px 0 0;font-size:12px;">
<a href="tel:+33${sig.phone.replace(/\s/g, '').replace(/^0/, '')}" style="color:#666;text-decoration:none;">${sig.phone}</a>
</p>
<p style="margin:3px 0 0;font-size:12px;">
<a href="mailto:${sig.email}" style="color:#666;text-decoration:none;">${sig.email}</a>
</p>
<p style="margin:3px 0 0;font-size:12px;">
<a href="https://${sig.website}" target="_blank" style="color:#E14B89;text-decoration:none;font-weight:500;">${sig.website}</a>
</p>
</td>
</tr>
</table>`
  }

  const FALLBACK_SIGNATURES: EmailSignature[] = [
    { id: 'benjamin', name: 'Benjamin', fullName: 'Benjamin Dayan', role: 'Directeur commercial', company: 'Agence Kameo', phone: '06 76 23 00 37', email: 'contact@agence-kameo.fr', website: 'www.agence-kameo.fr', photoUrl: '/benjamin-dayan.png', logoUrl: '/kameo-logo-light.png' },
    { id: 'louison', name: 'Louison', fullName: 'Louison Boutet', role: 'Directeur Général', company: 'Agence Kameo', phone: '06 14 17 06 24', email: 'louison.boutet@agence-kameo.fr', website: 'www.agence-kameo.fr', photoUrl: '/louison-boutet.png', logoUrl: '/kameo-logo-light.png' },
    { id: 'jonathan', name: 'Jonathan', fullName: 'Jonathan Derai', role: 'Commercial', company: 'Agence Kameo', phone: '07 66 63 66 96', email: 'derai.jonathan@agence-kameo.fr', website: 'www.agence-kameo.fr', photoUrl: '/jonathan-derai.png', logoUrl: '/kameo-logo-light.png' },
  ]

  function buildSignatureBlock(senderId: string) {
    const sigName = senderId
    const sigs = emailSignatures.length > 0 ? emailSignatures : FALLBACK_SIGNATURES
    const sig = sigs.find(s => s.id === sigName || s.name.toLowerCase() === sigName)
    if (!sig) return ''
    return signatureToHtml(sig)
  }

  const emailHeaderHtml = `<div style="background:linear-gradient(180deg,#000000 0%,#0a0a0a 100%);padding:28px 32px;border-radius:16px 16px 0 0;"><img src="https://kameo-tool.vercel.app/kameo-logo.png" alt="Kameo" height="32" style="height:32px;" /></div>`

  function buildEmailHtml(bodyContent: string, senderId: string) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
<tr><td style="background:linear-gradient(180deg,#000000 0%,#0a0a0a 100%);padding:28px 32px;">
<img src="https://kameo-tool.vercel.app/kameo-logo.png" alt="Kameo" height="32" style="height:32px;" />
</td></tr>
<tr><td style="padding:32px 32px 28px;">
${bodyContent}
${buildSignatureBlock(senderId)}
</td></tr>
</table>
</td></tr>
</table>
</body></html>`
  }

  const EMAIL_TEMPLATES: { id: string; name: string; emoji: string; desc: string; subject: (greeting: string) => string; body: (greeting: string) => string; html: (greeting: string, senderId: string) => string }[] = [
    {
      id: 'blank',
      name: 'Email vide',
      emoji: '📝',
      desc: 'Commencer de zéro',
      subject: () => '',
      body: (greeting) => `<p style="margin:0 0 16px;font-size:15px;color:#1a1a2e;line-height:1.6;">Bonjour ${greeting},</p>
<p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.6;"></p>
<p style="margin:0;font-size:15px;color:#444;line-height:1.6;">Bien cordialement,</p>`,
      html: (greeting, senderId) => buildEmailHtml(`<p style="margin:0 0 16px;font-size:15px;color:#1a1a2e;line-height:1.6;">Bonjour ${greeting},</p>
<p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.6;"></p>
<p style="margin:0;font-size:15px;color:#444;line-height:1.6;">Bien cordialement,</p>`, senderId),
    },
    {
      id: 'webapp',
      name: 'Web App / CRM',
      emoji: '🚀',
      desc: 'Suite à un appel — présentation CRM / ERP sur-mesure',
      subject: () => 'Suite à notre échange — Votre outil de gestion sur-mesure | Kameo',
      body: (greeting) => `<p style="margin:0 0 16px;font-size:15px;color:#1a1a2e;line-height:1.6;">Bonjour ${greeting},</p>
<p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.6;">Suite à notre échange, je me permets de vous envoyer comme convenu un aperçu de ce que nous pouvons mettre en place pour vous.</p>

<p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1a1a2e;">Un outil conçu pour <span style="color:#E14B89;">votre</span> activité</p>
<p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.6;">Chez <strong style="color:#1a1a2e;">Kameo</strong>, nous ne vendons pas de logiciel. Nous construisons <strong style="color:#1a1a2e;">votre propre application métier</strong> — CRM, ERP, outil de gestion — 100% taillée pour la façon dont vous travaillez.</p>

<table cellpadding="0" cellspacing="0" style="margin:0 0 24px;width:100%;">
<tr>
<td style="width:50%;padding:0 8px 12px 0;vertical-align:top;">
<table cellpadding="0" cellspacing="0" style="width:100%;background:#f8f9fa;border-radius:12px;overflow:hidden;">
<tr><td style="padding:20px;">
<p style="margin:0 0 6px;font-size:28px;">📊</p>
<p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#1a1a2e;">Tableau de bord</p>
<p style="margin:0;font-size:12px;color:#888;line-height:1.4;">Vos KPIs clés en un coup d'œil, en temps réel</p>
</td></tr>
</table>
</td>
<td style="width:50%;padding:0 0 12px 8px;vertical-align:top;">
<table cellpadding="0" cellspacing="0" style="width:100%;background:#f8f9fa;border-radius:12px;overflow:hidden;">
<tr><td style="padding:20px;">
<p style="margin:0 0 6px;font-size:28px;">🤝</p>
<p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#1a1a2e;">Gestion clients</p>
<p style="margin:0;font-size:12px;color:#888;line-height:1.4;">Contacts, historique, relances — tout centralisé</p>
</td></tr>
</table>
</td>
</tr>
<tr>
<td style="width:50%;padding:0 8px 12px 0;vertical-align:top;">
<table cellpadding="0" cellspacing="0" style="width:100%;background:#f8f9fa;border-radius:12px;overflow:hidden;">
<tr><td style="padding:20px;">
<p style="margin:0 0 6px;font-size:28px;">📄</p>
<p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#1a1a2e;">Devis & Factures</p>
<p style="margin:0;font-size:12px;color:#888;line-height:1.4;">Génération PDF, signature électronique, envoi auto</p>
</td></tr>
</table>
</td>
<td style="width:50%;padding:0 0 12px 8px;vertical-align:top;">
<table cellpadding="0" cellspacing="0" style="width:100%;background:#f8f9fa;border-radius:12px;overflow:hidden;">
<tr><td style="padding:20px;">
<p style="margin:0 0 6px;font-size:28px;">⚡</p>
<p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#1a1a2e;">Automatisations</p>
<p style="margin:0;font-size:12px;color:#888;line-height:1.4;">Relances, notifications, emails — sans y penser</p>
</td></tr>
</table>
</td>
</tr>
</table>

<table cellpadding="0" cellspacing="0" style="margin:0 0 24px;width:100%;">
<tr><td style="padding:16px 20px;background:#f8f9fa;border-radius:12px;border:1px solid #e5e7eb;">
<p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#1a1a2e;">Et aussi :</p>
<p style="margin:0;font-size:13px;color:#555;line-height:1.8;">Suivi de projets & tâches · Agenda synchronisé · Messagerie interne · Gestion d'équipe · Accessible sur tous vos appareils · Données 100% sécurisées</p>
</td></tr>
</table>

<p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1a1a2e;">Envie d'en savoir plus ?</p>
<p style="margin:0 0 24px;font-size:15px;color:#444;line-height:1.6;">Je vous propose un échange de <strong style="color:#1a1a2e;">15 minutes</strong> pour voir concrètement ce que ça donnerait pour vous — sans engagement.</p>
<table cellpadding="0" cellspacing="0" style="margin:0 0 28px;"><tr><td style="background:linear-gradient(135deg,#E14B89,#F8903C);border-radius:10px;padding:14px 32px;">
<a href="https://calendly.com/contact-agence-kameo/30min" target="_blank" style="color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;display:block;text-align:center;">Réserver un créneau →</a>
</td></tr></table>
<p style="margin:0;font-size:15px;color:#444;line-height:1.6;">Bien cordialement,</p>`,
      html: (greeting, senderId) => buildEmailHtml(`<p style="margin:0 0 16px;font-size:15px;color:#1a1a2e;line-height:1.6;">Bonjour ${greeting},</p>
<p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.6;">Suite à notre échange, je me permets de vous envoyer comme convenu un aperçu de ce que nous pouvons mettre en place pour vous.</p>

<p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1a1a2e;">Un outil conçu pour <span style="color:#E14B89;">votre</span> activité</p>
<p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.6;">Chez <strong style="color:#1a1a2e;">Kameo</strong>, nous ne vendons pas de logiciel. Nous construisons <strong style="color:#1a1a2e;">votre propre application métier</strong> — CRM, ERP, outil de gestion — 100% taillée pour la façon dont vous travaillez.</p>

<table cellpadding="0" cellspacing="0" style="margin:0 0 24px;width:100%;">
<tr>
<td style="width:50%;padding:0 8px 12px 0;vertical-align:top;">
<table cellpadding="0" cellspacing="0" style="width:100%;background:#f8f9fa;border-radius:12px;overflow:hidden;">
<tr><td style="padding:20px;">
<p style="margin:0 0 6px;font-size:28px;">📊</p>
<p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#1a1a2e;">Tableau de bord</p>
<p style="margin:0;font-size:12px;color:#888;line-height:1.4;">Vos KPIs clés en un coup d'œil, en temps réel</p>
</td></tr>
</table>
</td>
<td style="width:50%;padding:0 0 12px 8px;vertical-align:top;">
<table cellpadding="0" cellspacing="0" style="width:100%;background:#f8f9fa;border-radius:12px;overflow:hidden;">
<tr><td style="padding:20px;">
<p style="margin:0 0 6px;font-size:28px;">🤝</p>
<p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#1a1a2e;">Gestion clients</p>
<p style="margin:0;font-size:12px;color:#888;line-height:1.4;">Contacts, historique, relances — tout centralisé</p>
</td></tr>
</table>
</td>
</tr>
<tr>
<td style="width:50%;padding:0 8px 12px 0;vertical-align:top;">
<table cellpadding="0" cellspacing="0" style="width:100%;background:#f8f9fa;border-radius:12px;overflow:hidden;">
<tr><td style="padding:20px;">
<p style="margin:0 0 6px;font-size:28px;">📄</p>
<p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#1a1a2e;">Devis & Factures</p>
<p style="margin:0;font-size:12px;color:#888;line-height:1.4;">Génération PDF, signature électronique, envoi auto</p>
</td></tr>
</table>
</td>
<td style="width:50%;padding:0 0 12px 8px;vertical-align:top;">
<table cellpadding="0" cellspacing="0" style="width:100%;background:#f8f9fa;border-radius:12px;overflow:hidden;">
<tr><td style="padding:20px;">
<p style="margin:0 0 6px;font-size:28px;">⚡</p>
<p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#1a1a2e;">Automatisations</p>
<p style="margin:0;font-size:12px;color:#888;line-height:1.4;">Relances, notifications, emails — sans y penser</p>
</td></tr>
</table>
</td>
</tr>
</table>

<table cellpadding="0" cellspacing="0" style="margin:0 0 24px;width:100%;">
<tr><td style="padding:16px 20px;background:#f8f9fa;border-radius:12px;border:1px solid #e5e7eb;">
<p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#1a1a2e;">Et aussi :</p>
<p style="margin:0;font-size:13px;color:#555;line-height:1.8;">Suivi de projets & tâches · Agenda synchronisé · Messagerie interne · Gestion d'équipe · Accessible sur tous vos appareils · Données 100% sécurisées</p>
</td></tr>
</table>

<p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1a1a2e;">Envie d'en savoir plus ?</p>
<p style="margin:0 0 24px;font-size:15px;color:#444;line-height:1.6;">Je vous propose un échange de <strong style="color:#1a1a2e;">15 minutes</strong> pour voir concrètement ce que ça donnerait pour vous — sans engagement.</p>
<table cellpadding="0" cellspacing="0" style="margin:0 0 28px;"><tr><td style="background:linear-gradient(135deg,#E14B89,#F8903C);border-radius:10px;padding:14px 32px;">
<a href="https://calendly.com/contact-agence-kameo/30min" target="_blank" style="color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;display:block;text-align:center;">Réserver un créneau →</a>
</td></tr></table>
<p style="margin:0;font-size:15px;color:#444;line-height:1.6;">Bien cordialement,</p>`, senderId),
    },
    {
      id: 'signature',
      name: 'Signature / Coordonnées',
      emoji: '✉️',
      desc: 'Suite à un appel — transmettre nos coordonnées',
      subject: () => 'Nos coordonnées — Kameo',
      body: (greeting) => `<p style="margin:0 0 16px;font-size:15px;color:#1a1a2e;line-height:1.6;">Bonjour ${greeting},</p>
<p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.6;">Suite à notre échange, voici nos coordonnées comme convenu :</p>
<table cellpadding="0" cellspacing="0" style="margin:0 0 24px;width:100%;background:#f8f9fa;border-radius:12px;overflow:hidden;">
<tr><td style="padding:24px;">
<p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#1a1a2e;">Agence Kameo</p>
<p style="margin:0 0 16px;font-size:13px;color:#888;">Agence digitale sur-mesure</p>
<table cellpadding="0" cellspacing="0" style="width:100%;">
<tr><td style="padding:6px 0;font-size:14px;color:#444;">📞 <a href="tel:+33676230037" style="color:#444;text-decoration:none;">06 76 23 00 37</a></td></tr>
<tr><td style="padding:6px 0;font-size:14px;color:#444;">📧 <a href="mailto:contact@agence-kameo.fr" style="color:#444;text-decoration:none;">contact@agence-kameo.fr</a></td></tr>
<tr><td style="padding:6px 0;font-size:14px;">🌐 <a href="https://www.agence-kameo.fr" target="_blank" style="color:#E14B89;text-decoration:none;font-weight:500;">www.agence-kameo.fr</a></td></tr>
<tr><td style="padding:6px 0;font-size:14px;color:#444;">📍 9 rue des colonnes, Paris 75002</td></tr>
</table>
</td></tr>
</table>
<p style="margin:0 0 4px;font-size:15px;color:#444;line-height:1.6;">N'hésitez pas à nous recontacter pour toute question.</p>
<p style="margin:0;font-size:15px;color:#444;line-height:1.6;">À très bientôt,</p>`,
      html: (greeting, senderId) => buildEmailHtml(`<p style="margin:0 0 16px;font-size:15px;color:#1a1a2e;line-height:1.6;">Bonjour ${greeting},</p>
<p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.6;">Suite à notre échange, voici nos coordonnées comme convenu :</p>
<table cellpadding="0" cellspacing="0" style="margin:0 0 24px;width:100%;background:#f8f9fa;border-radius:12px;overflow:hidden;">
<tr><td style="padding:24px;">
<p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#1a1a2e;">Agence Kameo</p>
<p style="margin:0 0 16px;font-size:13px;color:#888;">Agence digitale sur-mesure</p>
<table cellpadding="0" cellspacing="0" style="width:100%;">
<tr><td style="padding:6px 0;font-size:14px;color:#444;">📞 <a href="tel:+33676230037" style="color:#444;text-decoration:none;">06 76 23 00 37</a></td></tr>
<tr><td style="padding:6px 0;font-size:14px;color:#444;">📧 <a href="mailto:contact@agence-kameo.fr" style="color:#444;text-decoration:none;">contact@agence-kameo.fr</a></td></tr>
<tr><td style="padding:6px 0;font-size:14px;">🌐 <a href="https://www.agence-kameo.fr" target="_blank" style="color:#E14B89;text-decoration:none;font-weight:500;">www.agence-kameo.fr</a></td></tr>
<tr><td style="padding:6px 0;font-size:14px;color:#444;">📍 9 rue des colonnes, Paris 75002</td></tr>
</table>
</td></tr>
</table>
<p style="margin:0 0 4px;font-size:15px;color:#444;line-height:1.6;">N'hésitez pas à nous recontacter pour toute question.</p>
<p style="margin:0;font-size:15px;color:#444;line-height:1.6;">À très bientôt,</p>`, senderId),
    },
  ]

  // Lead search (scraping)
  interface LeadSearchItem { id: string; keyword: string; location: string; resultCount: number; withEmail: number; createdAt: string }
  const [leadSearches, setLeadSearches] = useState<LeadSearchItem[]>([])
  const [activeLeadSearchId, setActiveLeadSearchId] = useState<string | null>(null)
  const [showLeadScrapeModal, setShowLeadScrapeModal] = useState(false)
  const [leadScrapeName, setLeadScrapeName] = useState('')
  const [leadScrapeKeyword, setLeadScrapeKeyword] = useState('')
  const [leadScrapeLocations, setLeadScrapeLocations] = useState<string[]>(['Paris'])
  const [leadScraping, setLeadScraping] = useState(false)
  const [leadScrapeProgress, setLeadScrapeProgress] = useState(0)
  const [leadScrapeMessage, setLeadScrapeMessage] = useState('')
  const [leadScrapeMode, setLeadScrapeMode] = useState<'scrape' | 'excel'>('scrape')
  const [leadFilters, setLeadFilters] = useState({ website: 'with' as string, address: 'all' as string, type: 'company' as string, phone: 'mobile' as string })

  // Plaquette
  const [plaqLang, setPlaqLang] = useState<'fr' | 'en' | 'es'>('fr')

  // Relances
  const [relances, setRelances] = useState<Relance[]>([])
  const [showRelanceModal, setShowRelanceModal] = useState(false)
  const [relanceForm, setRelanceForm] = useState({ prospectId: '', type: 'APPEL', date: '', notes: '' })

  // Videos
  const [videos, setVideos] = useState<Video[]>([])
  const [showVideoModal, setShowVideoModal] = useState(false)
  const [videoForm, setVideoForm] = useState({ title: '', url: '', description: '', category: '' })

  // Speech
  const [speeches, setSpeeches] = useState<Speech[]>([])
  const [showSpeechModal, setShowSpeechModal] = useState(false)
  const [editSpeech, setEditSpeech] = useState<Speech | null>(null)
  const [speechForm, setSpeechForm] = useState({ title: '', content: '' })
  const [expandedSpeech, setExpandedSpeech] = useState<string | null>(null)
  const [viewSpeech, setViewSpeech] = useState<Speech | null>(null)

  // Commissions
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [showCommissionModal, setShowCommissionModal] = useState(false)
  const [commissionForm, setCommissionForm] = useState({ amount: '', type: 'SIGNATURE', date: '', prospectId: '', notes: '', paid: false })

  // ---- Load user info ----
  useEffect(() => {
    if (!id) return
    async function loadUser() {
      try {
        const res = await fetch('/api/users')
        const users: UserInfo[] = await res.json()
        const found = users.find(u => u.id === id)
        setUser(found ?? null)
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    loadUser()
  }, [id])

  // ---- Load tab data ----
  const loadLeads = useCallback(async () => {
    const [res, searchRes] = await Promise.all([
      fetch(`/api/prospects?userId=${id}`),
      fetch(`/api/leads/searches?userId=${id}`),
    ])
    const data = await res.json()
    if (Array.isArray(data)) setProspects(data)
    const searchData = await searchRes.json()
    if (Array.isArray(searchData)) {
      // Only update if the list actually changed (avoids resetting filters)
      setLeadSearches(prev => {
        if (prev.length === searchData.length && prev.every((s, i) => s.id === searchData[i]?.id)) return prev
        return searchData
      })
    }
  }, [id])

  const loadRelances = useCallback(async () => {
    const res = await fetch(`/api/relances?userId=${id}`)
    const data = await res.json()
    if (Array.isArray(data)) setRelances(data)
  }, [id])

  const loadVideos = useCallback(async () => {
    const res = await fetch('/api/commercial-videos')
    const data = await res.json()
    if (Array.isArray(data)) setVideos(data)
  }, [])

  const loadSpeeches = useCallback(async () => {
    const res = await fetch(`/api/speeches?userId=${id}`)
    const data = await res.json()
    if (Array.isArray(data)) setSpeeches(data)
  }, [id])

  const loadCommissions = useCallback(async () => {
    const res = await fetch(`/api/commissions?userId=${id}`)
    const data = await res.json()
    if (Array.isArray(data)) setCommissions(data)
  }, [id])

  useEffect(() => {
    if (!id) return
    if (activeTab === 'leads') loadLeads()
    else if (activeTab === 'stats') { loadLeads() }
    else if (activeTab === 'videos') loadVideos()
    else if (activeTab === 'speech') loadSpeeches()
    else if (activeTab === 'commissions') { loadCommissions(); loadLeads() }
  }, [activeTab, id, loadLeads, loadRelances, loadVideos, loadSpeeches, loadCommissions])

  const refreshData = useCallback(() => {
    if (!id) return
    // Refresh user info
    fetch('/api/users').then(r => r.json()).then((users: UserInfo[]) => {
      const found = users.find(u => u.id === id)
      setUser(found ?? null)
    }).catch(() => {})
    // Refresh active tab data
    if (activeTab === 'leads') loadLeads()
    else if (activeTab === 'stats') { loadLeads() }
    else if (activeTab === 'videos') loadVideos()
    else if (activeTab === 'speech') loadSpeeches()
    else if (activeTab === 'commissions') { loadCommissions(); loadLeads() }
  }, [id, activeTab, loadLeads, loadRelances, loadVideos, loadSpeeches, loadCommissions])

  usePolling(refreshData)

  // ---- Lead handlers ----
  function openLeadModal(item?: Prospect) {
    if (item) {
      setEditLead(item)
      setLeadForm({
        firstName: item.firstName ?? '',
        lastName: item.lastName ?? '',
        company: item.company ?? item.name ?? '',
        email: item.email ?? '',
        phone: item.phone ?? '',
        budget: item.budget?.toString() ?? '',
        source: item.source ?? '',
        notes: item.notes ?? '',
      })
    } else {
      setEditLead(null)
      setLeadForm({ firstName: '', lastName: '', company: '', email: '', phone: '', budget: '', source: '', notes: '' })
    }
    setShowLeadModal(true)
  }

  async function submitLead(e: React.FormEvent) {
    e.preventDefault()
    const fullName = `${leadForm.firstName.trim()} ${leadForm.lastName.trim()}`.trim()
    const payload = {
      name: fullName || leadForm.company.trim(),
      firstName: leadForm.firstName.trim() || null,
      lastName: leadForm.lastName.trim() || null,
      company: leadForm.company.trim() || null,
      email: leadForm.email || null,
      phone: leadForm.phone || null,
      budget: leadForm.budget ? parseFloat(leadForm.budget) : null,
      source: leadForm.source || null,
      notes: leadForm.notes || null,
      assignedTo: id,
      status: editLead?.status ?? 'A_CONTACTER',
    }
    try {
      if (editLead) {
        const res = await fetch(`/api/prospects/${editLead.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
        if (!res.ok) { const err = await res.json().catch(() => ({})); alert(err.error || 'Erreur lors de la modification'); return }
        const updated = await res.json()
        setProspects(prev => prev.map(p => p.id === editLead.id ? updated : p))
      } else {
        const res = await fetch('/api/prospects', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
        if (!res.ok) { const err = await res.json().catch(() => ({})); alert(err.error || 'Erreur lors de la création'); return }
        const created = await res.json()
        setProspects(prev => [created, ...prev])
        // Switch to manual leads view so the new lead is visible
        if (activeLeadSearchId !== 'manual') setActiveLeadSearchId('manual')
      }
      setShowLeadModal(false)
    } catch {
      alert('Erreur réseau')
    }
  }

  // Delete lead state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteLeadId, setDeleteLeadId] = useState<string | null>(null)

  function deleteLead(leadId: string) {
    setDeleteLeadId(leadId)
    setShowDeleteModal(true)
  }

  async function confirmDeleteLead() {
    if (!deleteLeadId) return
    await fetch(`/api/prospects/${deleteLeadId}`, { method: 'DELETE' })
    setProspects(prev => prev.filter(p => p.id !== deleteLeadId))
    setShowDeleteModal(false)
    setDeleteLeadId(null)
  }

  async function handleImportExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('userId', id)
      const res = await fetch('/api/prospects/import', { method: 'POST', body: fd })
      if (res.ok) {
        await loadLeads()
      } else {
        const err = await res.json()
        alert(err.error || 'Erreur lors de l\'import')
      }
    } catch {
      alert('Erreur lors de l\'import')
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ---- Inline status change ----
  async function changeLeadStatus(leadId: string, newStatus: string) {
    setStatusDropdownId(null)
    if (newStatus === 'A_RAPPELER') {
      const lead = prospects.find(p => p.id === leadId)
      setCallbackLeadId(leadId)
      setCallbackDate(new Date().toISOString().slice(0, 10))
      setCallbackTime('')
      setCallbackNotes(lead?.notes ?? '')
      setShowCallbackModal(true)
      return
    }
    const body: Record<string, unknown> = { status: newStatus }
    // Clear callbackDate when changing away from A_RAPPELER
    body.callbackDate = null
    const res = await fetch(`/api/prospects/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const updated = await res.json()
      setProspects(prev => prev.map(p => p.id === leadId ? updated : p))
    }
  }

  async function submitCallback() {
    if (!callbackLeadId || !callbackDate) return
    const dateStr = callbackTime ? `${callbackDate}T${callbackTime}:00` : `${callbackDate}T09:00:00`
    const res = await fetch(`/api/prospects/${callbackLeadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'A_RAPPELER', callbackDate: new Date(dateStr).toISOString(), notes: callbackNotes.trim() || null }),
    })
    if (res.ok) {
      const updated = await res.json()
      setProspects(prev => prev.map(p => p.id === callbackLeadId ? updated : p))
    }
    setShowCallbackModal(false)
    setCallbackLeadId(null)
  }

  // ---- Email lead ----
  function openEmailModal(lead: Prospect) {
    setEmailTarget(lead)
    setEmailTemplateId(null)
    const parts = lead.name.split(' ')
    setEmailCivilite('M.')
    setEmailContactLastName(parts.slice(1).join(' ') || parts[0] || '')
    setEmailForm({
      senderId: 'jonathan',
      senderName: 'Jonathan Derai',
      subject: '',
      rawHtml: '',
      bodyContent: '',
      scheduled: false,
      scheduledDate: '',
      scheduledTime: '',
    })
    setShowEmailModal(true)
  }

  function selectEmailTemplate(templateId: string) {
    if (!emailTarget) return
    const tpl = EMAIL_TEMPLATES.find(t => t.id === templateId)
    if (!tpl) return
    const greeting = `${emailCivilite === 'Mme' ? 'Madame' : 'Monsieur'} ${emailContactLastName.trim()}`
    const body = tpl.body(greeting)
    setEmailForm(prev => ({
      ...prev,
      subject: tpl.subject(greeting),
      bodyContent: body,
      rawHtml: buildEmailHtml(body, prev.senderId),
    }))
    setEmailTemplateId(templateId)
  }

  async function sendLeadEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!emailTarget?.email) return
    setSendingEmail(true)
    // Rebuild full HTML from edited body content
    const currentBody = emailBodyRef.current?.innerHTML || emailForm.bodyContent
    const finalHtml = currentBody ? buildEmailHtml(currentBody, emailForm.senderId) : emailForm.rawHtml
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailTarget.email,
          subject: emailForm.subject,
          rawHtml: finalHtml,
          body: finalHtml ? undefined : 'Voir la version HTML.',
          senderId: emailForm.senderId,
          senderName: emailForm.senderName,
        }),
      })
      if (res.ok) {
        // Auto-set lead status to MAIL_ENVOYE
        if (emailTarget.id) {
          const statusRes = await fetch(`/api/prospects/${emailTarget.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'MAIL_ENVOYE', callbackDate: null }),
          })
          if (statusRes.ok) {
            const updated = await statusRes.json()
            setProspects(prev => prev.map(p => p.id === emailTarget.id ? updated : p))
          }
        }
        setShowEmailModal(false)
        alert('Email envoyé !')
      } else {
        const err = await res.json()
        alert(err.error || 'Erreur lors de l\'envoi')
      }
    } catch {
      alert('Erreur lors de l\'envoi')
    } finally {
      setSendingEmail(false)
    }
  }

  // Close status dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setStatusDropdownId(null)
      }
      if (listFilterRef.current && !listFilterRef.current.contains(e.target as Node)) {
        setShowListFilter(false)
      }
    }
    if (statusDropdownId || showListFilter) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [statusDropdownId, showListFilter])

  // Initialize selectedLists to 'all' only on first load
  const searchesInitialized = useRef(false)
  useEffect(() => {
    if (leadSearches.length > 0 && !searchesInitialized.current) {
      searchesInitialized.current = true
    }
  }, [leadSearches])

  // ---- Relance handlers ----
  function openRelanceModal() {
    setRelanceForm({ prospectId: prospects[0]?.id ?? '', type: 'APPEL', date: new Date().toISOString().slice(0, 10), notes: '' })
    setShowRelanceModal(true)
  }

  async function submitRelance(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/relances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...relanceForm, userId: id }),
    })
    const created = await res.json()
    setRelances(prev => [...prev, created])
    setShowRelanceModal(false)
  }

  async function toggleRelanceDone(relance: Relance) {
    const res = await fetch(`/api/relances/${relance.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: !relance.done }),
    })
    const updated = await res.json()
    setRelances(prev => prev.map(r => r.id === relance.id ? updated : r))
  }

  async function deleteRelance(relanceId: string) {
    if (!confirm('Supprimer cette relance ?')) return
    await fetch(`/api/relances/${relanceId}`, { method: 'DELETE' })
    setRelances(prev => prev.filter(r => r.id !== relanceId))
  }

  // ---- Video handlers ----
  function openVideoModal() {
    setVideoForm({ title: '', url: '', description: '', category: '' })
    setShowVideoModal(true)
  }

  async function submitVideo(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/commercial-videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(videoForm),
    })
    const created = await res.json()
    setVideos(prev => [created, ...prev])
    setShowVideoModal(false)
  }

  async function deleteVideo(videoId: string) {
    if (!confirm('Supprimer cette video ?')) return
    await fetch(`/api/commercial-videos/${videoId}`, { method: 'DELETE' })
    setVideos(prev => prev.filter(v => v.id !== videoId))
  }

  // ---- Speech handlers ----
  function openSpeechModal(item?: Speech) {
    if (item) {
      setEditSpeech(item)
      setSpeechForm({ title: item.title, content: item.content })
    } else {
      setEditSpeech(null)
      setSpeechForm({ title: '', content: '' })
    }
    setShowSpeechModal(true)
  }

  async function submitSpeech(e: React.FormEvent) {
    e.preventDefault()
    if (editSpeech) {
      const res = await fetch(`/api/speeches/${editSpeech.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(speechForm),
      })
      const updated = await res.json()
      setSpeeches(prev => prev.map(s => s.id === editSpeech.id ? updated : s))
    } else {
      const res = await fetch('/api/speeches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...speechForm, userId: id }),
      })
      const created = await res.json()
      setSpeeches(prev => [created, ...prev])
    }
    setShowSpeechModal(false)
  }

  async function deleteSpeech(speechId: string) {
    if (!confirm('Supprimer ce speech ?')) return
    await fetch(`/api/speeches/${speechId}`, { method: 'DELETE' })
    setSpeeches(prev => prev.filter(s => s.id !== speechId))
  }

  // ---- Commission handlers ----
  function openCommissionModal() {
    setCommissionForm({ amount: '', type: 'SIGNATURE', date: new Date().toISOString().slice(0, 10), prospectId: '', notes: '', paid: false })
    setShowCommissionModal(true)
  }

  async function submitCommission(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/commissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: id,
        amount: parseFloat(commissionForm.amount),
        type: commissionForm.type,
        date: commissionForm.date,
        prospectId: commissionForm.prospectId || null,
        notes: commissionForm.notes || null,
        paid: commissionForm.paid,
      }),
    })
    const created = await res.json()
    setCommissions(prev => [created, ...prev])
    setShowCommissionModal(false)
  }

  async function toggleCommissionPaid(commission: Commission) {
    const res = await fetch(`/api/commissions/${commission.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paid: !commission.paid }),
    })
    const updated = await res.json()
    setCommissions(prev => prev.map(c => c.id === commission.id ? updated : c))
  }

  async function deleteCommission(commissionId: string) {
    if (!confirm('Supprimer cette commission ?')) return
    await fetch(`/api/commissions/${commissionId}`, { method: 'DELETE' })
    setCommissions(prev => prev.filter(c => c.id !== commissionId))
  }

  // ---- Filtered leads (used inline in tab) ----

  // ---- Commission summary ----
  const totalCommissions = commissions.reduce((s, c) => s + c.amount, 0)
  const paidCommissions = commissions.filter(c => c.paid).reduce((s, c) => s + c.amount, 0)
  const pendingCommissions = commissions.filter(c => !c.paid).reduce((s, c) => s + c.amount, 0)

  // ---- Loading / not found ----
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a12]">
        <Loader2 size={24} className="animate-spin text-slate-500" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#0a0a12] gap-4">
        <p className="text-slate-400">Utilisateur introuvable</p>
        <Link href="/commerciaux" className="text-sm text-[#E14B89] hover:underline">Retour</Link>
      </div>
    )
  }

  const gradient = ROLE_AVATAR_COLORS[user.role] ?? ROLE_AVATAR_COLORS.COMMERCIAL
  const initials = getInitials(user.name)

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="p-4 sm:p-8 min-h-screen">
      {/* ----------------------------------------------------------------- */}
      {/* HEADER                                                            */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/commerciaux" className="p-2 rounded-xl border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}>
          <span className="text-white font-semibold text-sm">{initials}</span>
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">{user.name}</h1>
          <p className="text-slate-500 text-sm">{user.email}</p>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* TABS                                                              */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex gap-1 mb-6 border-b border-slate-800 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-[#E14B89] text-white'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* TAB: LEADS                                                        */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'leads' && (
        <div>
          {/* Actions bar */}
          <div className="flex flex-wrap items-center gap-3 mb-5 justify-between">
            <div className="flex items-center gap-2" />
            <div className="flex items-center gap-3">
              <button onClick={() => openLeadModal()} className="flex items-center gap-2 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white px-4 py-2 rounded-xl text-sm transition-colors">
                <Plus size={16} /> Ajouter manuellement
              </button>
              <button onClick={() => { setShowLeadScrapeModal(true); setLeadScrapeMode('scrape'); setLeadScrapeMessage(''); setLeadScrapeProgress(0) }} className="flex items-center gap-2 bg-gradient-to-r from-[#E14B89] to-[#F8903C] hover:opacity-90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-opacity">
                <Plus size={16} /> Nouvelle liste
              </button>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportExcel} />
            </div>
          </div>

          {/* Filters row: status left, lists right */}
          <div className="flex flex-wrap items-center gap-2 mb-5 justify-between">
            <div className="flex flex-wrap gap-2">
              {Object.entries(STATUS_LABELS).filter(([key]) => !['DEVIS_TRANSMETTRE', 'DEVIS_ENVOYE', 'A_RELANCER'].includes(key)).map(([key, label]) => {
                const count = prospects.filter(p => p.status === key).length
                return (
                  <button
                    key={key}
                    onClick={() => setLeadFilter(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      leadFilter === key
                        ? 'bg-[#E14B89]/10 text-[#E14B89] border border-[#E14B89]/20'
                        : 'bg-[#111118] border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    {label}{count > 0 ? ` (${count})` : ''}
                  </button>
                )
              })}
            </div>
            {/* Lists filter dropdown */}
            <div className="relative" ref={listFilterRef}>
              <button
                onClick={() => setShowListFilter(!showListFilter)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  !selectedLists.has('all')
                    ? 'bg-[#E14B89]/10 text-[#E14B89] border border-[#E14B89]/20'
                    : 'bg-[#111118] border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <Briefcase size={12} /> Listes
                <ChevronDown size={12} />
              </button>
              {showListFilter && (
                <div className="absolute top-full right-0 mt-1 bg-[#1a1a24] border border-slate-700 rounded-xl py-2 z-50 min-w-[240px] shadow-xl">
                  {/* All */}
                  <button
                    onClick={() => setSelectedLists(new Set(['all']))}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2 ${selectedLists.has('all') ? 'text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/30'}`}
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${selectedLists.has('all') ? 'bg-[#E14B89] border-[#E14B89]' : 'border-slate-600'}`}>
                      {selectedLists.has('all') && <Check size={10} className="text-white" />}
                    </span>
                    Toutes les listes
                  </button>
                  <div className="border-t border-slate-800 my-1" />
                  {/* Manual leads */}
                  {prospects.some(p => !p.leadSearchId) && (
                    <button
                      onClick={() => {
                        const next = new Set(selectedLists)
                        next.delete('all')
                        if (next.has('manual')) next.delete('manual'); else next.add('manual')
                        if (next.size === 0) next.add('all')
                        setSelectedLists(next)
                      }}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2 ${selectedLists.has('manual') ? 'text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/30'}`}
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${selectedLists.has('manual') ? 'bg-[#E14B89] border-[#E14B89]' : 'border-slate-600'}`}>
                        {selectedLists.has('manual') && <Check size={10} className="text-white" />}
                      </span>
                      Leads manuels
                      <span className="text-slate-600 ml-auto">{prospects.filter(p => !p.leadSearchId).length}</span>
                    </button>
                  )}
                  {/* Search-based lists */}
                  {leadSearches.map(search => (
                    <button
                      key={search.id}
                      onClick={() => {
                        const next = new Set(selectedLists)
                        next.delete('all')
                        if (next.has(search.id)) next.delete(search.id); else next.add(search.id)
                        if (next.size === 0) next.add('all')
                        setSelectedLists(next)
                      }}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2 ${selectedLists.has(search.id) ? 'text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/30'}`}
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${selectedLists.has(search.id) ? 'bg-[#E14B89] border-[#E14B89]' : 'border-slate-600'}`}>
                        {selectedLists.has(search.id) && <Check size={10} className="text-white" />}
                      </span>
                      <span className="truncate">{search.keyword} · {search.location}</span>
                      <span className="text-slate-600 ml-auto flex-shrink-0">{search.resultCount}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Search bar */}
          <div className="relative mb-4">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={leadSearchQuery}
              onChange={e => setLeadSearchQuery(e.target.value)}
              placeholder="Rechercher un lead..."
              className="w-full bg-[#111118] border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors placeholder:text-slate-600"
            />
          </div>

          {/* All leads filtered */}
          {(() => {
            const filteredByList = selectedLists.has('all')
              ? prospects
              : prospects.filter(p => {
                  if (!p.leadSearchId && selectedLists.has('manual')) return true
                  if (p.leadSearchId && selectedLists.has(p.leadSearchId)) return true
                  return false
                })
            const q = leadSearchQuery.toLowerCase().trim()
            const visibleLeads = filteredByList
              .filter(l => leadFilter === 'ALL' || l.status === leadFilter)
              .filter(l => !q || l.name.toLowerCase().includes(q) || l.company?.toLowerCase().includes(q) || l.email?.toLowerCase().includes(q) || l.phone?.includes(q))
              .sort((a, b) => {
                // Sort A_RAPPELER by callbackDate
                if (leadFilter === 'A_RAPPELER' && a.callbackDate && b.callbackDate) {
                  return new Date(a.callbackDate).getTime() - new Date(b.callbackDate).getTime()
                }
                return 0
              })
            return visibleLeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Briefcase size={24} className="text-slate-700 mb-3" />
                <p className="text-slate-500 text-sm">Aucun lead</p>
              </div>
            ) : (
              <div className="space-y-2">
                {visibleLeads.map(lead => (
                <div
                  key={lead.id}
                  className="bg-[#111118] border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors group cursor-pointer"
                  onClick={() => openLeadModal(lead)}
                >
                  <div className="flex items-center gap-3">
                    {/* Entreprise/nom + statut — gauche */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="min-w-0 w-[160px]">
                        <p className="text-white text-sm font-medium truncate">{lead.company || lead.name}</p>
                        <p className="text-slate-500 text-xs truncate">{lead.company ? lead.name : ''}</p>
                      </div>
                      <div className="relative" ref={statusDropdownId === lead.id ? statusDropdownRef : undefined}>
                        <button
                          onClick={e => { e.stopPropagation(); setStatusDropdownId(statusDropdownId === lead.id ? null : lead.id) }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 hover:opacity-80 transition-opacity ${STATUS_COLORS[lead.status] ?? 'bg-slate-500/15 text-slate-400'}`}
                        >
                          {STATUS_LABELS[lead.status] ?? lead.status}
                          <ChevronDown size={12} />
                        </button>
                        {statusDropdownId === lead.id && (
                          <div className="absolute top-full left-0 mt-1 bg-[#1a1a24] border border-slate-700 rounded-xl py-1 z-50 min-w-[180px] shadow-xl">
                            {Object.entries(STATUS_LABELS).filter(([key]) => !['DEVIS_TRANSMETTRE', 'DEVIS_ENVOYE', 'A_RELANCER'].includes(key)).map(([key, label]) => (
                              <button
                                key={key}
                                onClick={e => { e.stopPropagation(); changeLeadStatus(lead.id, key) }}
                                className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2 ${
                                  lead.status === key ? 'text-white bg-slate-700/50' : 'text-slate-400 hover:text-white hover:bg-slate-700/30'
                                }`}
                              >
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_COLORS[key]?.split(' ')[0]?.replace('/15', '') ?? 'bg-slate-500'}`} />
                                {label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Infos contact — milieu */}
                    <div className="flex-1 flex items-center gap-5 min-w-0 pl-8">
                      {/* Callback date for A_RAPPELER */}
                      {lead.status === 'A_RAPPELER' && lead.callbackDate && (
                        <span className="hidden md:flex items-center gap-1.5 text-orange-400 text-xs flex-shrink-0">
                          <Clock size={12} />
                          {new Date(lead.callbackDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                          {(() => {
                            const d = new Date(lead.callbackDate)
                            const h = d.getHours(); const m = d.getMinutes()
                            return (h !== 9 || m !== 0) ? ` ${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}` : ''
                          })()}
                        </span>
                      )}
                      {lead.website && (
                        <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="hidden md:flex items-center gap-1.5 text-[#E14B89] hover:text-[#F8903C] text-xs flex-shrink-0 transition-colors">
                          <Globe size={12} /> Site
                        </a>
                      )}
                      {lead.phone && (
                        <span className="hidden md:flex items-center gap-1.5 text-slate-500 text-xs flex-shrink-0">
                          <Phone size={12} /> {lead.phone}
                        </span>
                      )}
                      {lead.email && (
                        <span className="hidden lg:flex items-center gap-1.5 text-slate-500 text-xs truncate max-w-[220px] flex-shrink-0">
                          <Mail size={12} /> {lead.email}
                        </span>
                      )}
                      {lead.notes && (
                        <span className="hidden xl:flex items-center gap-1.5 text-slate-600 text-xs truncate max-w-[180px] flex-shrink-0 italic">
                          {lead.notes}
                        </span>
                      )}
                    </div>
                    {/* Actions — droite */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <a
                        href="https://calendly.com/contact-agence-kameo/30min"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="p-1.5 text-slate-500 hover:text-[#F8903C] transition-colors"
                        title="Réserver un créneau Calendly"
                      >
                        <Calendar size={14} />
                      </a>
                      {lead.email && (
                        <button
                          onClick={e => { e.stopPropagation(); openEmailModal(lead) }}
                          className="p-1.5 text-slate-500 hover:text-[#E14B89] transition-colors"
                          title="Envoyer un email"
                        >
                          <Send size={14} />
                        </button>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); deleteLead(lead.id) }}
                        className="p-1.5 transition-colors text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100"
                        title="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              </div>
            )
          })()}

          {/* Lead modal */}
          {showLeadModal && (
            <ModalOverlay onClose={() => setShowLeadModal(false)}>
              <h2 className="text-white font-semibold text-lg mb-5">{editLead ? 'Modifier le lead' : 'Nouveau lead'}</h2>
              <form onSubmit={submitLead} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Entreprise *</label>
                    <input required value={leadForm.company} onChange={e => setLeadForm({ ...leadForm, company: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Telephone</label>
                    <input value={leadForm.phone} onChange={e => setLeadForm({ ...leadForm, phone: formatPhone(e.target.value) })} className={inputClass} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Prénom</label>
                    <input value={leadForm.firstName} onChange={e => setLeadForm({ ...leadForm, firstName: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Nom</label>
                    <input value={leadForm.lastName} onChange={e => setLeadForm({ ...leadForm, lastName: e.target.value })} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Email</label>
                  <input type="email" value={leadForm.email} onChange={e => setLeadForm({ ...leadForm, email: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Notes</label>
                  <textarea value={leadForm.notes} onChange={e => setLeadForm({ ...leadForm, notes: e.target.value })} rows={3} className={textareaClass} />
                </div>
                <ModalActions onCancel={() => setShowLeadModal(false)} submitLabel={editLead ? 'Sauvegarder' : 'Creer'} />
              </form>
            </ModalOverlay>
          )}

          {/* Callback modal (A_RAPPELER) */}
          {showCallbackModal && (
            <ModalOverlay onClose={() => { setShowCallbackModal(false); setCallbackLeadId(null) }}>
              <h2 className="text-white font-semibold text-lg mb-1">A rappeler</h2>
              <p className="text-slate-500 text-xs mb-5">Quand souhaitez-vous rappeler ce lead ?</p>
              <form onSubmit={e => { e.preventDefault(); submitCallback() }} className="space-y-4">
                <div>
                  <label className={labelClass}>Date *</label>
                  <input
                    type="date"
                    required
                    value={callbackDate}
                    onChange={e => setCallbackDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Heure (optionnel)</label>
                  <input
                    type="time"
                    value={callbackTime}
                    onChange={e => setCallbackTime(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Notes</label>
                  <textarea
                    value={callbackNotes}
                    onChange={e => setCallbackNotes(e.target.value)}
                    rows={3}
                    placeholder="Ex: Rappeler pour discuter du devis..."
                    className={textareaClass}
                  />
                </div>
                <ModalActions onCancel={() => { setShowCallbackModal(false); setCallbackLeadId(null) }} submitLabel="Confirmer" />
              </form>
            </ModalOverlay>
          )}

          {/* Delete confirmation modal */}
          {showDeleteModal && (
            <ModalOverlay onClose={() => { setShowDeleteModal(false); setDeleteLeadId(null) }}>
              <h2 className="text-white font-semibold text-lg mb-2">Supprimer le lead</h2>
              <p className="text-slate-400 text-sm mb-5">Etes-vous sur de vouloir supprimer ce lead ? Cette action est irreversible.</p>
              <div className="flex gap-3">
                <button onClick={() => { setShowDeleteModal(false); setDeleteLeadId(null) }} className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors">
                  Annuler
                </button>
                <button onClick={confirmDeleteLead} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
                  Supprimer
                </button>
              </div>
            </ModalOverlay>
          )}

          {/* Email modal */}
          {showEmailModal && emailTarget && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className={`bg-[#111118] border border-slate-800 rounded-2xl w-full relative max-h-[90vh] overflow-y-auto ${emailTemplateId ? 'max-w-2xl' : 'max-w-lg'}`}>
                <button onClick={() => setShowEmailModal(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white z-10"><X size={18} /></button>
                <div className="p-6">
                  <h2 className="text-white font-semibold text-lg mb-1">Envoyer un email</h2>
                  <p className="text-slate-500 text-xs mb-5">
                    À : <span className="text-slate-300">{emailTarget.name}</span> — <span className="text-slate-400">{emailTarget.email}</span>
                  </p>
                  {!emailTemplateId ? (
                    /* Civilité + Nom + Template picker */
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className={labelClass}>Civilité *</label>
                          <select value={emailCivilite} onChange={e => setEmailCivilite(e.target.value as 'M.' | 'Mme')} className={selectClass}>
                            <option value="M.">Monsieur</option>
                            <option value="Mme">Madame</option>
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className={labelClass}>Nom *</label>
                          <input value={emailContactLastName} onChange={e => setEmailContactLastName(e.target.value)} placeholder="Nom de famille" className={inputClass} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className={labelClass}>Choisir un template</label>
                        {EMAIL_TEMPLATES.map(tpl => (
                          <button
                            key={tpl.id}
                            disabled={!emailContactLastName.trim()}
                            onClick={() => selectEmailTemplate(tpl.id)}
                            className="w-full text-left bg-[#1a1a24] border border-slate-700 hover:border-[#E14B89]/50 rounded-xl p-4 transition-colors group disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-xl">{tpl.emoji}</span>
                              <div className="min-w-0">
                                <p className="text-white text-sm font-medium group-hover:text-[#E14B89] transition-colors">{tpl.name}</p>
                                <p className="text-slate-500 text-xs mt-0.5">{tpl.desc}</p>
                              </div>
                            </div>
                          </button>
                        ))}
                        {!emailContactLastName.trim() && (
                          <p className="text-slate-600 text-xs text-center mt-2">Renseignez le nom pour choisir un template</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Email form */
                    <form onSubmit={sendLeadEmail} className="space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <button type="button" onClick={() => setEmailTemplateId(null)} className="text-slate-500 hover:text-white transition-colors">
                          <ArrowLeft size={14} />
                        </button>
                        <span className="text-slate-500 text-xs">Template : <span className="text-slate-300">{EMAIL_TEMPLATES.find(t => t.id === emailTemplateId)?.name}</span></span>
                      </div>
                      <div>
                        <label className={labelClass}>Expéditeur</label>
                        <select
                          value={emailForm.senderId}
                          onChange={e => {
                            const account = SENDER_ACCOUNTS.find(a => a.id === e.target.value)
                            setEmailForm({ ...emailForm, senderId: e.target.value, senderName: account?.label || '' })
                          }}
                          className={selectClass}
                        >
                          {SENDER_ACCOUNTS.map(a => (
                            <option key={a.id} value={a.id}>{a.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Objet</label>
                        <input
                          required
                          value={emailForm.subject}
                          onChange={e => setEmailForm({ ...emailForm, subject: e.target.value })}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="flex items-center justify-between mb-1.5">
                          <span className={labelClass + ' mb-0'}>Contenu email</span>
                          <span className="text-slate-600 text-[10px]">Cliquez sur le texte pour modifier</span>
                        </label>
                        <div className="rounded-xl overflow-hidden border border-slate-700 max-h-[400px] overflow-y-auto bg-[#f5f5f5]">
                          {/* Header — read-only */}
                          <div dangerouslySetInnerHTML={{ __html: emailHeaderHtml }} />
                          {/* Body — editable */}
                          <div style={{ padding: '32px 32px 0', background: '#ffffff', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>
                            <div
                              ref={emailBodyRef}
                              contentEditable
                              suppressContentEditableWarning
                              dangerouslySetInnerHTML={{ __html: emailForm.bodyContent }}
                              className="outline-none focus:ring-1 focus:ring-[#E14B89]/30 rounded-lg min-h-[60px]"
                              style={{ fontSize: '15px', lineHeight: '1.6', color: '#444' }}
                            />
                            {/* Signature — read-only */}
                            <div dangerouslySetInnerHTML={{ __html: buildSignatureBlock(emailForm.senderId) }} />
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={emailForm.scheduled}
                            onChange={e => setEmailForm({ ...emailForm, scheduled: e.target.checked })}
                            className="rounded border-slate-600 bg-[#1a1a24] text-[#E14B89] focus:ring-[#E14B89]"
                          />
                          <span className="text-slate-400 text-sm flex items-center gap-1.5"><Clock size={13} /> Planifier l&apos;envoi</span>
                        </label>
                        {emailForm.scheduled && (
                          <div className="grid grid-cols-2 gap-3 mt-3">
                            <div>
                              <label className={labelClass}>Date</label>
                              <input
                                type="date"
                                value={emailForm.scheduledDate}
                                onChange={e => setEmailForm({ ...emailForm, scheduledDate: e.target.value })}
                                min={new Date().toISOString().slice(0, 10)}
                                className={inputClass}
                              />
                            </div>
                            <div>
                              <label className={labelClass}>Heure</label>
                              <input
                                type="time"
                                value={emailForm.scheduledTime}
                                onChange={e => setEmailForm({ ...emailForm, scheduledTime: e.target.value })}
                                className={inputClass}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setShowEmailModal(false)}
                          className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors">
                          Annuler
                        </button>
                        <button type="submit" disabled={sendingEmail}
                          className="flex-1 bg-gradient-to-r from-[#E14B89] to-[#F8903C] hover:opacity-90 disabled:opacity-40 text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                          {sendingEmail ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                          {emailForm.scheduled ? 'Planifier' : 'Envoyer'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Scrape / Import modal */}
          {showLeadScrapeModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-md relative">
                <button onClick={() => setShowLeadScrapeModal(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X size={18} /></button>
                <h2 className="text-white font-semibold text-lg mb-5">Nouvelle liste</h2>

                {/* Mode toggle */}
                <div className="flex bg-[#0d0d14] rounded-xl p-0.5 mb-5">
                  <button onClick={() => setLeadScrapeMode('scrape')}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${leadScrapeMode === 'scrape' ? 'bg-[#E14B89]/10 text-[#E14B89]' : 'text-slate-400'}`}>
                    Scraping Google Maps
                  </button>
                  <button onClick={() => setLeadScrapeMode('excel')}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${leadScrapeMode === 'excel' ? 'bg-[#E14B89]/10 text-[#E14B89]' : 'text-slate-400'}`}>
                    Importer Excel
                  </button>
                </div>

                {leadScrapeMode === 'scrape' ? (
                  <form onSubmit={async (e) => {
                    e.preventDefault()
                    if (!leadScrapeKeyword.trim() || leadScrapeLocations.length === 0 || leadScraping) return
                    setLeadScraping(true)
                    setLeadScrapeProgress(1)
                    setLeadScrapeMessage('Lancement du scraping...')
                    let lastSearchId: string | null = null
                    try {
                      for (let li = 0; li < leadScrapeLocations.length; li++) {
                        const loc = leadScrapeLocations[li]
                        setLeadScrapeMessage(`${loc} : Envoi de la requête... (${li + 1}/${leadScrapeLocations.length})`)
                        setLeadScrapeProgress(2)
                        const res = await fetch('/api/leads/search', {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ keyword: leadScrapeKeyword, location: loc, userId: id, filters: leadFilters, listName: leadScrapeName.trim() || undefined }),
                        })
                        if (!res.ok) {
                          const errText = await res.text().catch(() => res.statusText)
                          setLeadScrapeMessage(`Erreur ${res.status}: ${errText}`)
                          setLeadScrapeProgress(0)
                          setLeadScraping(false)
                          return
                        }
                        const reader = res.body?.getReader()
                        const decoder = new TextDecoder()
                        let needsScraping = false
                        if (reader) {
                          let buffer = ''
                          while (true) {
                            const { done, value } = await reader.read()
                            if (done) break
                            buffer += decoder.decode(value, { stream: true })
                            const lines = buffer.split('\n\n')
                            buffer = lines.pop() || ''
                            for (const line of lines) {
                              if (!line.startsWith('data: ')) continue
                              try {
                                const data = JSON.parse(line.slice(6))
                                if (data.progress !== undefined) setLeadScrapeProgress(data.progress)
                                if (data.message) setLeadScrapeMessage(data.step === 'error' ? `❌ ${data.message}` : data.message)
                                if (data.searchId) lastSearchId = data.searchId
                                if (data.needsScraping) needsScraping = true
                              } catch { /* */ }
                            }
                          }
                        }
                        // Batch scrape emails (like partners)
                        if (needsScraping && lastSearchId) {
                          setLeadScrapeMessage('Scraping des emails...')
                          let scraping = true
                          while (scraping) {
                            const batchRes = await fetch('/api/leads/scrape-batch', {
                              method: 'POST', headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ searchId: lastSearchId }),
                            })
                            const batchData = await batchRes.json()
                            if (batchData.status === 'done') {
                              scraping = false
                              setLeadScrapeMessage(`Terminé ! ${batchData.withEmail || 0} emails trouvés`)
                              setLeadScrapeProgress(100)
                            } else if (batchData.status === 'scraping') {
                              const pct = batchData.total > 0 ? Math.round((batchData.scraped / batchData.total) * 100) : 50
                              setLeadScrapeProgress(pct)
                              setLeadScrapeMessage(`Emails : ${batchData.scraped}/${batchData.total} traités (${batchData.batchFound} trouvés)`)
                            } else {
                              scraping = false
                            }
                          }
                        }
                      }
                      await loadLeads()
                      if (lastSearchId) {
                        setActiveLeadSearchId(lastSearchId)
                        setShowLeadScrapeModal(false)
                        setLeadScrapeKeyword('')
                        setLeadScrapeName('')
                      }
                      // If no search was created, keep modal open so user sees the message
                    } catch (err) { setLeadScrapeMessage(`❌ Erreur: ${err instanceof Error ? err.message : String(err)}`) } finally {
                      setLeadScraping(false)
                    }
                  }} className="space-y-4">
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">Nom de la liste</label>
                      <input value={leadScrapeName} onChange={e => setLeadScrapeName(e.target.value)}
                        placeholder="ex: Restaurants Lyon avril 2026"
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89]" />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">Secteur d&apos;activité *</label>
                      <input value={leadScrapeKeyword} onChange={e => setLeadScrapeKeyword(e.target.value)}
                        placeholder="ex: restaurant, avocat, agence immobilière..."
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89]" />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">Villes ({leadScrapeLocations.length})</label>
                      <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto">
                        {LEAD_LOCATIONS.map(l => (
                          <button key={l} type="button"
                            onClick={() => setLeadScrapeLocations(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l])}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all text-left ${
                              leadScrapeLocations.includes(l) ? 'bg-[#E14B89]/15 border border-[#E14B89]/40 text-white' : 'bg-[#1a1a24] border border-slate-800 text-slate-400'
                            }`}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">Filtres</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="flex items-center gap-2 bg-[#1a1a24] border border-slate-800 rounded-lg px-3 py-2">
                          <span className="text-[10px] text-slate-500 whitespace-nowrap">Site web</span>
                          <select value={leadFilters.website} onChange={e => setLeadFilters(f => ({ ...f, website: e.target.value }))}
                            className="flex-1 bg-transparent text-white text-xs focus:outline-none min-w-0">
                            <option value="all">Tous</option>
                            <option value="with">Avec</option>
                            <option value="without">Sans</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2 bg-[#1a1a24] border border-slate-800 rounded-lg px-3 py-2">
                          <span className="text-[10px] text-slate-500 whitespace-nowrap">Adresse</span>
                          <select value={leadFilters.address} onChange={e => setLeadFilters(f => ({ ...f, address: e.target.value }))}
                            className="flex-1 bg-transparent text-white text-xs focus:outline-none min-w-0">
                            <option value="all">Tous</option>
                            <option value="with">Avec</option>
                            <option value="without">Sans</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2 bg-[#1a1a24] border border-slate-800 rounded-lg px-3 py-2">
                          <span className="text-[10px] text-slate-500 whitespace-nowrap">Type</span>
                          <select value={leadFilters.type} onChange={e => setLeadFilters(f => ({ ...f, type: e.target.value }))}
                            className="flex-1 bg-transparent text-white text-xs focus:outline-none min-w-0">
                            <option value="all">Tous</option>
                            <option value="company">Sociétés</option>
                            <option value="freelance">Indépendants</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2 bg-[#1a1a24] border border-slate-800 rounded-lg px-3 py-2">
                          <span className="text-[10px] text-slate-500 whitespace-nowrap">Téléphone</span>
                          <select value={leadFilters.phone} onChange={e => setLeadFilters(f => ({ ...f, phone: e.target.value }))}
                            className="flex-1 bg-transparent text-white text-xs focus:outline-none min-w-0">
                            <option value="all">Tous</option>
                            <option value="mobile">Portable (06/07)</option>
                            <option value="landline">Fixe (01-05/09)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    {(leadScraping || leadScrapeMessage) && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className={`truncate mr-2 ${leadScrapeMessage.startsWith('❌') ? 'text-red-400' : 'text-slate-400'}`}>{leadScrapeMessage}</span>
                          {leadScraping && <span className="text-white font-medium flex-shrink-0">{leadScrapeProgress}%</span>}
                        </div>
                        {leadScraping && (
                          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${leadScrapeProgress}%`, background: 'linear-gradient(135deg, #E14B89, #F8903C)' }} />
                          </div>
                        )}
                      </div>
                    )}
                    <button type="submit" disabled={leadScraping || !leadScrapeKeyword.trim() || leadScrapeLocations.length === 0}
                      className="w-full bg-gradient-to-r from-[#E14B89] to-[#F8903C] hover:opacity-90 text-white py-2.5 rounded-xl text-sm font-medium transition-opacity disabled:opacity-40">
                      {leadScraping ? 'Scraping en cours...' : 'Lancer la recherche'}
                    </button>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <p className="text-slate-400 text-sm">Importez un fichier Excel (.xlsx) avec les colonnes : Nom, Entreprise, Email, Téléphone</p>
                    <button onClick={() => { fileInputRef.current?.click(); setShowLeadScrapeModal(false) }}
                      className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#E14B89] to-[#F8903C] hover:opacity-90 text-white py-2.5 rounded-xl text-sm font-medium transition-opacity">
                      <Upload size={16} /> Choisir un fichier
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* TAB: RELANCES                                                     */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'stats' && (() => {
        const today = new Date().toISOString().slice(0, 10)
        const todayProspects = prospects.filter(p => p.statusHistory?.some(s => s) && p.updatedAt && p.updatedAt.slice(0, 10) === today)

        const countStatus = (status: string) => prospects.filter(p => p.status === status || (p.statusHistory || []).includes(status)).length
        const countToday = (status: string) => todayProspects.filter(p => p.status === status).length

        const stats = [
          { label: 'Leads total', value: prospects.length, color: 'text-slate-400', bg: 'bg-slate-500/15' },
          { label: 'Pas répondu', value: countStatus('PAS_REPONDU'), color: 'text-yellow-400', bg: 'bg-yellow-500/15' },
          { label: 'Mails envoyés', value: countStatus('MAIL_ENVOYE'), color: 'text-teal-400', bg: 'bg-teal-500/15' },
          { label: 'Visios planifiées', value: countStatus('VISIO_PLANIFIE'), color: 'text-indigo-400', bg: 'bg-indigo-500/15' },
          { label: 'À rappeler', value: prospects.filter(p => p.status === 'A_RAPPELER').length, color: 'text-orange-400', bg: 'bg-orange-500/15' },
          { label: 'Refusés', value: countStatus('REFUSE'), color: 'text-red-400', bg: 'bg-red-500/15' },
          { label: 'Signés', value: countStatus('SIGNE'), color: 'text-green-400', bg: 'bg-green-500/15' },
        ]

        const todayStats = [
          { label: 'Appels (statuts modifiés)', value: countToday('PAS_REPONDU') + countToday('A_RAPPELER') + countToday('MAIL_ENVOYE') + countToday('VISIO_PLANIFIE') + countToday('REFUSE') + countToday('SIGNE') },
          { label: 'Mails envoyés', value: countToday('MAIL_ENVOYE') },
          { label: 'Visios planifiées', value: countToday('VISIO_PLANIFIE') },
          { label: 'Refusés', value: countToday('REFUSE') },
          { label: 'Signés', value: countToday('SIGNE') },
        ]

        const conversionRate = prospects.length > 0 ? Math.round((countStatus('SIGNE') / prospects.length) * 100) : 0

        return (
          <div className="space-y-6">
            {/* Today */}
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
              <h3 className="text-white font-medium mb-4">Aujourd&apos;hui</h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                {todayStats.map(s => (
                  <div key={s.label} className="text-center">
                    <p className="text-2xl font-bold text-white">{s.value}</p>
                    <p className="text-slate-500 text-xs mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Global stats */}
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-medium">Vue d&apos;ensemble</h3>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-xs">Taux de conversion</span>
                  <span className={`text-sm font-bold ${conversionRate >= 20 ? 'text-emerald-400' : conversionRate >= 10 ? 'text-amber-400' : 'text-slate-400'}`}>{conversionRate}%</span>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {stats.map(s => (
                  <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-slate-500 text-[10px] mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}

      {/* ----------------------------------------------------------------- */}
      {/* TAB: VIDEOS                                                       */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'videos' && (
        <div>
          {isAdmin && (
            <div className="mb-5">
              <button onClick={openVideoModal} className="flex items-center gap-2 bg-gradient-to-r from-[#E14B89] to-[#F8903C] hover:opacity-90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-opacity">
                <Plus size={16} /> Ajouter une video
              </button>
            </div>
          )}

          {videos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Play size={24} className="text-slate-700 mb-3" />
              <p className="text-slate-500 text-sm">Aucune video</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {videos.map(video => {
                const ytId = getYouTubeId(video.url)
                return (
                  <div key={video.id} className="bg-[#111118] border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition-colors group">
                    {/* Thumbnail */}
                    <a href={video.url} target="_blank" rel="noopener noreferrer" className="block relative aspect-video bg-[#0a0a12]">
                      {ytId ? (
                        <img
                          src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                          alt={video.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Play size={40} className="text-slate-700" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                          <Play size={20} className="text-white ml-0.5" />
                        </div>
                      </div>
                    </a>
                    {/* Info */}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <a href={video.url} target="_blank" rel="noopener noreferrer" className="text-white text-sm font-medium hover:text-[#E14B89] transition-colors line-clamp-1">
                            {video.title}
                          </a>
                          {video.description && <p className="text-slate-500 text-xs mt-1 line-clamp-2">{video.description}</p>}
                        </div>
                        {isAdmin && (
                          <button onClick={() => deleteVideo(video.id)} className="p-1.5 text-slate-600 hover:text-red-400 transition-colors flex-shrink-0">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      {video.category && (
                        <span className="inline-block mt-2 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-500/15 text-slate-400">
                          {video.category}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Video modal */}
          {showVideoModal && (
            <ModalOverlay onClose={() => setShowVideoModal(false)}>
              <h2 className="text-white font-semibold text-lg mb-5">Ajouter une video</h2>
              <form onSubmit={submitVideo} className="space-y-4">
                <div>
                  <label className={labelClass}>Titre *</label>
                  <input required value={videoForm.title} onChange={e => setVideoForm({ ...videoForm, title: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>URL (YouTube) *</label>
                  <input required value={videoForm.url} onChange={e => setVideoForm({ ...videoForm, url: e.target.value })} placeholder="https://youtube.com/watch?v=..." className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Description</label>
                  <textarea value={videoForm.description} onChange={e => setVideoForm({ ...videoForm, description: e.target.value })} rows={3} className={textareaClass} />
                </div>
                <div>
                  <label className={labelClass}>Categorie</label>
                  <input value={videoForm.category} onChange={e => setVideoForm({ ...videoForm, category: e.target.value })} placeholder="Formation, Technique..." className={inputClass} />
                </div>
                <ModalActions onCancel={() => setShowVideoModal(false)} submitLabel="Ajouter" />
              </form>
            </ModalOverlay>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* TAB: SPEECH                                                       */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'speech' && (
        <div>
          <div className="mb-5">
            <button onClick={() => openSpeechModal()} className="flex items-center gap-2 bg-gradient-to-r from-[#E14B89] to-[#F8903C] hover:opacity-90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-opacity">
              <Plus size={16} /> Nouveau speech
            </button>
          </div>

          {speeches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <FileText size={24} className="text-slate-700 mb-3" />
              <p className="text-slate-500 text-sm">Aucun speech</p>
            </div>
          ) : (
            <div className="space-y-3">
              {speeches.map(speech => {
                const isExpanded = expandedSpeech === speech.id
                return (
                  <div
                    key={speech.id}
                    className="bg-[#111118] border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-colors"
                  >
                    <div
                      className="p-4 cursor-pointer flex items-start justify-between gap-3"
                      onClick={() => setExpandedSpeech(isExpanded ? null : speech.id)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <FileText size={14} className="text-slate-600 flex-shrink-0" />
                          <p className="text-white text-sm font-medium truncate">{speech.title}</p>
                        </div>
                        {!isExpanded && (
                          <p className="text-slate-500 text-xs line-clamp-1 ml-[22px]">
                            {speech.content.slice(0, 100)}{speech.content.length > 100 ? '...' : ''}
                          </p>
                        )}
                        <p className="text-slate-600 text-xs mt-1 ml-[22px]">{formatDate(speech.updatedAt)}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={e => { e.stopPropagation(); setViewSpeech(speech) }} className="p-1.5 text-slate-600 hover:text-[#E14B89] transition-colors" title="Voir">
                          <Eye size={14} />
                        </button>
                        <button onClick={e => { e.stopPropagation(); openSpeechModal(speech) }} className="p-1.5 text-slate-600 hover:text-white transition-colors" title="Modifier">
                          <Pencil size={14} />
                        </button>
                        <button onClick={e => { e.stopPropagation(); deleteSpeech(speech.id) }} className="p-1.5 text-slate-600 hover:text-red-400 transition-colors" title="Supprimer">
                          <Trash2 size={14} />
                        </button>
                        <ChevronDown size={14} className={`text-slate-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-0">
                        <div className="bg-[#0a0a12] rounded-xl p-4 text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">
                          {speech.content}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Speech modal */}
          {showSpeechModal && (
            <ModalOverlay onClose={() => setShowSpeechModal(false)}>
              <h2 className="text-white font-semibold text-lg mb-5">{editSpeech ? 'Modifier le speech' : 'Nouveau speech'}</h2>
              <form onSubmit={submitSpeech} className="space-y-4">
                <div>
                  <label className={labelClass}>Titre *</label>
                  <input required value={speechForm.title} onChange={e => setSpeechForm({ ...speechForm, title: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Contenu *</label>
                  <textarea required value={speechForm.content} onChange={e => setSpeechForm({ ...speechForm, content: e.target.value })} rows={8} className={textareaClass} />
                </div>
                <ModalActions onCancel={() => setShowSpeechModal(false)} submitLabel={editSpeech ? 'Sauvegarder' : 'Creer'} />
              </form>
            </ModalOverlay>
          )}

          {/* Speech reader modal */}
          {viewSpeech && (
            <div className="fixed inset-0 bg-[#0a0a12]/95 backdrop-blur-sm z-50 flex items-start justify-center overflow-y-auto">
              <div className="w-full max-w-2xl mx-auto px-6 py-12 sm:py-16">
                {/* Close + Download */}
                <div className="fixed top-6 right-6 flex items-center gap-2 z-50">
                  <button onClick={async () => {
                    const el = document.getElementById('speech-view-content')
                    if (!el) return
                    try {
                      const { default: html2canvas } = await import('html2canvas-pro')
                      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#0a0a12', useCORS: true, logging: false })
                      const base64 = canvas.toDataURL('image/png').split(',')[1]
                      const bin = atob(base64)
                      const bytes = new Uint8Array(bin.length)
                      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
                      const { PDFDocument } = await import('pdf-lib')
                      const pdfDoc = await PDFDocument.create()
                      const img = await pdfDoc.embedPng(bytes)
                      const pageWidth = 595.28
                      const pageHeight = pageWidth * (img.height / img.width)
                      const page = pdfDoc.addPage([pageWidth, pageHeight])
                      page.drawImage(img, { x: 0, y: 0, width: pageWidth, height: pageHeight })
                      const pdfBytes = await pdfDoc.save()
                      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `speech-${viewSpeech.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.pdf`
                      document.body.appendChild(a)
                      a.click()
                      document.body.removeChild(a)
                      URL.revokeObjectURL(url)
                    } catch (err) {
                      alert('Erreur: ' + (err instanceof Error ? err.message : 'Erreur'))
                    }
                  }}
                    className="p-2 text-slate-500 hover:text-[#E14B89] transition-colors bg-slate-800/50 rounded-xl hover:bg-slate-800" title="Télécharger PDF">
                    <FileText size={20} />
                  </button>
                  <button onClick={() => setViewSpeech(null)}
                    className="p-2 text-slate-500 hover:text-white transition-colors bg-slate-800/50 rounded-xl hover:bg-slate-800">
                    <X size={20} />
                  </button>
                </div>

                {/* Title */}
                <div id="speech-view-content">
                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 leading-tight">{viewSpeech.title}</h1>
                <p className="text-slate-500 text-sm mb-10">{formatDate(viewSpeech.updatedAt)}</p>

                {/* Divider */}
                <div className="w-12 h-0.5 rounded-full mb-10" style={{ background: 'linear-gradient(135deg, #E14B89, #F8903C)' }} />

                {/* Content */}
                <div className="prose prose-invert max-w-none">
                  {viewSpeech.content.split('\n').map((line, i) => {
                    const trimmed = line.trim()
                    if (!trimmed) return <div key={i} className="h-4" />
                    // Detect section headers (all caps, short lines, or lines ending with :)
                    const isHeader = (trimmed === trimmed.toUpperCase() && trimmed.length < 60 && trimmed.length > 2) || trimmed.endsWith(':')
                    if (isHeader) {
                      return <h2 key={i} className="text-lg font-semibold text-white mt-8 mb-3">{trimmed}</h2>
                    }
                    // Detect bullet points
                    if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('→')) {
                      return (
                        <p key={i} className="text-slate-300 text-[15px] leading-relaxed pl-5 mb-1.5 relative">
                          <span className="absolute left-0 text-[#E14B89]">{trimmed[0]}</span>
                          {trimmed.slice(1).trim()}
                        </p>
                      )
                    }
                    return <p key={i} className="text-slate-300 text-[15px] leading-[1.8] mb-3">{trimmed}</p>
                  })}
                </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* TAB: COMMISSIONS                                                  */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'commissions' && (
        <div>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-[#111118] border border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign size={14} className="text-slate-500" />
                <span className="text-slate-500 text-xs">Total commissions</span>
              </div>
              <p className="text-white text-lg font-semibold">{formatCurrency(totalCommissions)}</p>
            </div>
            <div className="bg-[#111118] border border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={14} className="text-green-500" />
                <span className="text-slate-500 text-xs">Payees</span>
              </div>
              <p className="text-green-400 text-lg font-semibold">{formatCurrency(paidCommissions)}</p>
            </div>
            <div className="bg-[#111118] border border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar size={14} className="text-amber-500" />
                <span className="text-slate-500 text-xs">En attente</span>
              </div>
              <p className="text-amber-400 text-lg font-semibold">{formatCurrency(pendingCommissions)}</p>
            </div>
          </div>

          {/* Add button (admin) */}
          {isAdmin && (
            <div className="mb-5">
              <button onClick={openCommissionModal} className="flex items-center gap-2 bg-gradient-to-r from-[#E14B89] to-[#F8903C] hover:opacity-90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-opacity">
                <Plus size={16} /> Ajouter
              </button>
            </div>
          )}

          {/* Commissions table */}
          {commissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Euro size={24} className="text-slate-700 mb-3" />
              <p className="text-slate-500 text-sm">Aucune commission</p>
            </div>
          ) : (
            <div className="space-y-2">
              {commissions.map(commission => (
                <div key={commission.id} className="bg-[#111118] border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors group">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <span className="text-slate-500 text-xs flex-shrink-0 w-[80px]">
                        {formatDate(commission.date)}
                      </span>
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium flex-shrink-0 ${COMMISSION_TYPE_COLORS[commission.type] ?? 'bg-slate-500/15 text-slate-400'}`}>
                        {COMMISSION_TYPE_LABELS[commission.type] ?? commission.type}
                      </span>
                      <span className="text-white text-sm font-medium flex-shrink-0">
                        {formatCurrency(commission.amount)}
                      </span>
                      {commission.prospect?.name && (
                        <span className="text-slate-500 text-xs truncate hidden sm:block">
                          {commission.prospect.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${commission.paid ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                        {commission.paid ? 'Paye' : 'En attente'}
                      </span>
                      {commission.notes && (
                        <span className="text-slate-600 text-xs hidden md:block max-w-[150px] truncate" title={commission.notes}>
                          {commission.notes}
                        </span>
                      )}
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => toggleCommissionPaid(commission)}
                            className={`p-1.5 transition-colors ${commission.paid ? 'text-green-500 hover:text-amber-400' : 'text-slate-600 hover:text-green-400'}`}
                            title={commission.paid ? 'Marquer non paye' : 'Marquer paye'}
                          >
                            {commission.paid ? <Check size={14} /> : <CheckCircle2 size={14} />}
                          </button>
                          <button onClick={() => deleteCommission(commission.id)} className="p-1.5 text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Commission modal */}
          {showCommissionModal && (
            <ModalOverlay onClose={() => setShowCommissionModal(false)}>
              <h2 className="text-white font-semibold text-lg mb-5">Ajouter une commission</h2>
              <form onSubmit={submitCommission} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Montant (EUR) *</label>
                    <input required type="number" step="0.01" value={commissionForm.amount} onChange={e => setCommissionForm({ ...commissionForm, amount: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Type</label>
                    <select value={commissionForm.type} onChange={e => setCommissionForm({ ...commissionForm, type: e.target.value })} className={selectClass}>
                      <option value="SIGNATURE">Signature</option>
                      <option value="BONUS">Bonus</option>
                      <option value="PARRAINAGE">Parrainage</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Date *</label>
                    <input required type="date" value={commissionForm.date} onChange={e => setCommissionForm({ ...commissionForm, date: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Prospect</label>
                    <select value={commissionForm.prospectId} onChange={e => setCommissionForm({ ...commissionForm, prospectId: e.target.value })} className={selectClass}>
                      <option value="">Aucun</option>
                      {prospects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Notes</label>
                  <textarea value={commissionForm.notes} onChange={e => setCommissionForm({ ...commissionForm, notes: e.target.value })} rows={3} className={textareaClass} />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCommissionForm({ ...commissionForm, paid: !commissionForm.paid })}
                    className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${commissionForm.paid ? 'bg-green-500 border-green-500' : 'border-slate-700 bg-[#1a1a24]'}`}
                  >
                    {commissionForm.paid && <Check size={12} className="text-white" />}
                  </button>
                  <span className="text-slate-400 text-sm">Deja payee</span>
                </div>
                <ModalActions onCancel={() => setShowCommissionModal(false)} submitLabel="Ajouter" />
              </form>
            </ModalOverlay>
          )}
        </div>
      )}

      {activeTab === 'plaquette' && (() => {
        const langs = { fr: 'Français', en: 'English', es: 'Español' } as const
        type Lang = keyof typeof langs
        const t: Record<Lang, Record<string, string>> = {
          fr: {
            heroTitle: 'Votre outil de gestion\n100% sur mesure',
            heroSub: 'Centralisez toute la gestion de votre entreprise dans une application web moderne, sécurisée et personnalisée.',
            problemLabel: 'Le constat',
            problemTitle: 'Vous perdez du temps et de l\'argent avec des outils dispersés',
            problemDesc: 'Excel, Google Sheets, emails, WhatsApp... Vos données sont éparpillées, votre équipe perd en efficacité, et vous n\'avez aucune visibilité sur votre activité.',
            crmLabel: 'Pourquoi pas un CRM classique ?',
            crmTitle: 'Les outils généralistes ne répondent pas à vos besoins spécifiques',
            crmDesc: 'Salesforce, HubSpot, Monday... Ces plateformes sont conçues pour tout le monde, donc pour personne en particulier. Vous payez pour des dizaines de fonctionnalités inutiles, et il vous manque toujours celle dont vous avez besoin. Avec notre solution, chaque fonctionnalité est pensée pour votre métier. Et le produit vous appartient.',
            solutionLabel: 'Notre solution',
            solutionTitle: 'Un outil qui centralise tout',
            f1t: 'Suivi et relances clients', f1d: 'Pipeline commercial, historique des échanges, relances automatiques',
            f2t: 'Devis et factures en 1 clic', f2d: 'Génération automatique, signature en ligne, suivi des paiements',
            f3t: 'Agenda connecté', f3d: 'Synchronisation Google Calendar, planification, rendez-vous automatiques',
            f4t: 'Gestion d\'équipe', f4d: 'Attribution des tâches, suivi d\'avancement, droits d\'accès personnalisés',
            f5t: 'Automatisations', f5d: 'Emails automatiques, notifications, génération de documents, synchronisation outils externes',
            f6t: 'Sécurité & hébergement', f6d: 'Données chiffrées, sauvegardes automatiques, hébergement haute disponibilité',
            unlimitedTitle: 'Fonctionnalités illimitées',
            unlimitedSub: 'Chaque fonctionnalité est développée sur mesure pour votre métier',
            ownerTitle: 'Le produit vous appartient',
            ownerDesc: 'Contrairement aux abonnements SaaS, votre application vous appartient. Pas de frais mensuels cachés, pas de dépendance à un éditeur, pas de données piégées.',
            delay: '3 sem.', delayLabel: 'Délai de livraison',
            price: '5 000€', priceLabel: 'À partir de (HT)',
            custom: '100%', customLabel: 'Sur mesure',
            howTitle: 'Comment ça marche',
            s1t: 'Échange gratuit', s1d: 'On analyse vos besoins et on vous propose une solution adaptée',
            s2t: 'Maquettes & validation', s2d: 'On conçoit les maquettes de votre application, vous validez chaque écran',
            s3t: 'Développement', s3d: 'Notre équipe développe votre outil avec les dernières technologies',
            s4t: 'Livraison & formation', s4d: 'Votre outil est en ligne, on vous forme à son utilisation',
            ctaTitle: 'Prêt à centraliser votre activité ?',
            ctaSub: 'Prenez rendez-vous pour une démonstration gratuite et sans engagement',
            ctaBtn: 'Prendre rendez-vous',
            footer1: 'Agence Kameo — Création de sites internet haut de gamme & applications web sur mesure',
            footer2: 'contact@agence-kameo.fr — 06 76 23 00 37',
            fl1: 'CRM personnalisé', fl2: 'Tableau de bord', fl3: 'Génération de PDF', fl4: 'Gestion documentaire', fl5: 'Notifications', fl6: 'Rapports et statistiques', fl7: 'Intégration API', fl8: 'Système de rôles', fl9: 'Messagerie interne', fl10: 'Recherche avancée', fl11: 'Import / Export', fl12: 'Mode hors ligne',
          },
          en: {
            heroTitle: 'Your custom-built\nmanagement tool',
            heroSub: 'Centralize your entire business management in a modern, secure, and personalized web application.',
            problemLabel: 'The problem',
            problemTitle: 'You\'re losing time and money with scattered tools',
            problemDesc: 'Excel, Google Sheets, emails, WhatsApp... Your data is everywhere, your team loses efficiency, and you have no visibility on your activity.',
            crmLabel: 'Why not a standard CRM?',
            crmTitle: 'Generic tools don\'t meet your specific needs',
            crmDesc: 'Salesforce, HubSpot, Monday... These platforms are designed for everyone, so for no one in particular. You pay for dozens of useless features, and you\'re always missing the one you need. With our solution, every feature is designed for your business. And you own the product.',
            solutionLabel: 'Our solution',
            solutionTitle: 'One tool that centralizes everything',
            f1t: 'Client follow-up & reminders', f1d: 'Sales pipeline, exchange history, automatic follow-ups',
            f2t: 'Quotes & invoices in 1 click', f2d: 'Automatic generation, online signature, payment tracking',
            f3t: 'Connected calendar', f3d: 'Google Calendar sync, scheduling, automatic appointments',
            f4t: 'Team management', f4d: 'Task assignment, progress tracking, custom access rights',
            f5t: 'Automations', f5d: 'Automatic emails, notifications, document generation, external tool sync',
            f6t: 'Security & hosting', f6d: 'Encrypted data, automatic backups, high-availability hosting',
            unlimitedTitle: 'Unlimited features',
            unlimitedSub: 'Every feature is custom-built for your business',
            ownerTitle: 'You own the product',
            ownerDesc: 'Unlike SaaS subscriptions, your application belongs to you. No hidden monthly fees, no vendor lock-in, no trapped data.',
            delay: '3 weeks', delayLabel: 'Delivery time',
            price: '5,000€', priceLabel: 'Starting from (excl. tax)',
            custom: '100%', customLabel: 'Custom-built',
            howTitle: 'How it works',
            s1t: 'Free consultation', s1d: 'We analyze your needs and propose a tailored solution',
            s2t: 'Mockups & validation', s2d: 'We design your app mockups, you validate each screen',
            s3t: 'Development', s3d: 'Our team builds your tool with the latest technologies',
            s4t: 'Delivery & training', s4d: 'Your tool is live, we train your team on how to use it',
            ctaTitle: 'Ready to centralize your business?',
            ctaSub: 'Book a free, no-commitment demo',
            ctaBtn: 'Book a meeting',
            footer1: 'Agence Kameo — Premium website creation & custom web applications',
            footer2: 'contact@agence-kameo.fr — +33 6 76 23 00 37',
            fl1: 'Custom CRM', fl2: 'Dashboard', fl3: 'PDF generation', fl4: 'Document management', fl5: 'Notifications', fl6: 'Reports & analytics', fl7: 'API integration', fl8: 'Role system', fl9: 'Internal messaging', fl10: 'Advanced search', fl11: 'Import / Export', fl12: 'Offline mode',
          },
          es: {
            heroTitle: 'Su herramienta de gestión\n100% a medida',
            heroSub: 'Centralice toda la gestión de su empresa en una aplicación web moderna, segura y personalizada.',
            problemLabel: 'El problema',
            problemTitle: 'Pierde tiempo y dinero con herramientas dispersas',
            problemDesc: 'Excel, Google Sheets, emails, WhatsApp... Sus datos están en todas partes, su equipo pierde eficiencia y no tiene visibilidad sobre su actividad.',
            crmLabel: '¿Por qué no un CRM clásico?',
            crmTitle: 'Las herramientas genéricas no responden a sus necesidades',
            crmDesc: 'Salesforce, HubSpot, Monday... Estas plataformas están diseñadas para todos, es decir, para nadie en particular. Paga por docenas de funciones inútiles y siempre le falta la que necesita. Con nuestra solución, cada función está pensada para su negocio. Y el producto le pertenece.',
            solutionLabel: 'Nuestra solución',
            solutionTitle: 'Una herramienta que lo centraliza todo',
            f1t: 'Seguimiento de clientes', f1d: 'Pipeline comercial, historial de intercambios, recordatorios automáticos',
            f2t: 'Presupuestos y facturas en 1 clic', f2d: 'Generación automática, firma en línea, seguimiento de pagos',
            f3t: 'Agenda conectada', f3d: 'Sincronización Google Calendar, planificación, citas automáticas',
            f4t: 'Gestión de equipo', f4d: 'Asignación de tareas, seguimiento de progreso, permisos personalizados',
            f5t: 'Automatizaciones', f5d: 'Emails automáticos, notificaciones, generación de documentos, sincronización externa',
            f6t: 'Seguridad y alojamiento', f6d: 'Datos cifrados, copias de seguridad, alojamiento de alta disponibilidad',
            unlimitedTitle: 'Funcionalidades ilimitadas',
            unlimitedSub: 'Cada función se desarrolla a medida para su negocio',
            ownerTitle: 'El producto le pertenece',
            ownerDesc: 'A diferencia de las suscripciones SaaS, su aplicación le pertenece. Sin costes mensuales ocultos, sin dependencia de un editor, sin datos atrapados.',
            delay: '3 sem.', delayLabel: 'Plazo de entrega',
            price: '5.000€', priceLabel: 'Desde (sin IVA)',
            custom: '100%', customLabel: 'A medida',
            howTitle: 'Cómo funciona',
            s1t: 'Reunión gratuita', s1d: 'Analizamos sus necesidades y proponemos una solución adaptada',
            s2t: 'Maquetas y validación', s2d: 'Diseñamos las maquetas de su aplicación, usted valida cada pantalla',
            s3t: 'Desarrollo', s3d: 'Nuestro equipo desarrolla su herramienta con las últimas tecnologías',
            s4t: 'Entrega y formación', s4d: 'Su herramienta está en línea, le formamos en su uso',
            ctaTitle: '¿Listo para centralizar su actividad?',
            ctaSub: 'Reserve una demostración gratuita y sin compromiso',
            ctaBtn: 'Reservar una reunión',
            footer1: 'Agence Kameo — Creación de sitios web premium y aplicaciones web a medida',
            footer2: 'contact@agence-kameo.fr — +33 6 76 23 00 37',
            fl1: 'CRM personalizado', fl2: 'Panel de control', fl3: 'Generación PDF', fl4: 'Gestión documental', fl5: 'Notificaciones', fl6: 'Informes', fl7: 'Integración API', fl8: 'Sistema de roles', fl9: 'Mensajería interna', fl10: 'Búsqueda avanzada', fl11: 'Import / Export', fl12: 'Modo offline',
          },
        }
        const l = t[plaqLang]

        async function downloadPDF() {
          const el = document.getElementById('plaquette-content')
          if (!el) { alert('Élément non trouvé'); return }
          try {
            const { default: html2canvas } = await import('html2canvas-pro')
            const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#0a0a12', useCORS: true, logging: false })
            const imgData = canvas.toDataURL('image/png')
            // Convert data URL to ArrayBuffer without fetch
            const base64 = imgData.split(',')[1]
            const binaryStr = atob(base64)
            const imgBytes = new Uint8Array(binaryStr.length)
            for (let i = 0; i < binaryStr.length; i++) imgBytes[i] = binaryStr.charCodeAt(i)
            const { PDFDocument } = await import('pdf-lib')
            const pdfDoc = await PDFDocument.create()
            const img = await pdfDoc.embedPng(imgBytes)
            // Render as single continuous page (no splits = no artifacts)
            const pageWidth = 595.28
            const totalHeight = pageWidth * (img.height / img.width)
            const page = pdfDoc.addPage([pageWidth, totalHeight])
            page.drawImage(img, { x: 0, y: 0, width: pageWidth, height: totalHeight })
            const bytes = await pdfDoc.save()
            const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `kameo-webapp-plaquette-${plaqLang}.pdf`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
          } catch (err) {
            console.error('PDF error:', err)
            alert('Erreur lors de la génération du PDF: ' + (err instanceof Error ? err.message : 'Erreur inconnue'))
          }
        }

        return (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-white font-semibold">Plaquette commerciale — Web App</h2>
            <div className="flex items-center gap-3">
              <div className="flex bg-[#111118] border border-slate-800 rounded-xl p-0.5">
                {(Object.keys(langs) as Lang[]).map(k => (
                  <button key={k} onClick={() => setPlaqLang(k)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${plaqLang === k ? 'bg-[#E14B89]/10 text-[#E14B89]' : 'text-slate-400 hover:text-white'}`}>
                    {langs[k]}
                  </button>
                ))}
              </div>
              <button onClick={downloadPDF} className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
                Télécharger PDF
              </button>
            </div>
          </div>

          <div id="plaquette-content" className="bg-[#0a0a12] overflow-hidden max-w-3xl mx-auto" style={{ borderRadius: '16px' }}>
            {/* Hero */}
            <div className="relative px-8 sm:px-12 py-16 text-center" style={{ background: 'linear-gradient(135deg, #E14B89 0%, #F8903C 100%)' }}>
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/kameo-logo.png" alt="Kameo" className="h-8 mx-auto mb-8 brightness-0 invert" />
                <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4 leading-tight whitespace-pre-line">{l.heroTitle}</h1>
                <p className="text-white/80 text-lg max-w-lg mx-auto mb-6">{l.heroSub}</p>
                <div className="flex items-center justify-center gap-8 text-white/60 text-xs">
                  <span>Interface moderne</span>
                  <span className="w-1 h-1 rounded-full bg-white/40" />
                  <span>100% sécurisé</span>
                  <span className="w-1 h-1 rounded-full bg-white/40" />
                  <span>Support dédié</span>
                </div>
              </div>
            </div>

            {/* Pain point */}
            <div className="px-8 sm:px-12 py-10 border-b border-slate-800/50">
              <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-8 text-center">
                <p className="text-red-400 text-sm font-medium mb-3">{l.problemLabel}</p>
                <p className="text-white text-xl font-semibold mb-3">{l.problemTitle}</p>
                <p className="text-slate-400 text-sm max-w-lg mx-auto leading-relaxed">{l.problemDesc}</p>
                <div className="flex flex-wrap justify-center gap-3 mt-6">
                  {['Excel', 'Google Sheets', 'Emails', 'WhatsApp', 'Notion'].map(tool => (
                    <span key={tool} className="px-3 py-1.5 bg-red-500/10 border border-red-500/15 rounded-lg text-red-400/80 text-xs">{tool}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* CRM vs Custom */}
            <div className="px-8 sm:px-12 py-10 border-b border-slate-800/50">
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-8">
                <p className="text-amber-400 text-sm font-medium mb-3 text-center">{l.crmLabel}</p>
                <p className="text-white text-xl font-semibold mb-3 text-center">{l.crmTitle}</p>
                <p className="text-slate-400 text-sm max-w-lg mx-auto leading-relaxed text-center mb-6">{l.crmDesc}</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4 text-center">
                    <p className="text-red-400 text-xs font-medium mb-2">CRM généraliste</p>
                    <div className="space-y-1.5 text-xs text-slate-500">
                      <p>✕ Fonctionnalités inutiles</p>
                      <p>✕ Abonnement mensuel</p>
                      <p>✕ Données piégées</p>
                      <p>✕ Interface générique</p>
                    </div>
                  </div>
                  <div className="border rounded-xl p-4 text-center" style={{ borderColor: 'rgba(225,75,137,0.3)', background: 'rgba(225,75,137,0.03)' }}>
                    <p className="text-xs font-medium mb-2" style={{ color: '#E14B89' }}>Kameo Web App</p>
                    <div className="space-y-1.5 text-xs text-slate-400">
                      <p>✓ 100% adapté à votre métier</p>
                      <p>✓ Le produit vous appartient</p>
                      <p>✓ Vos données, vos règles</p>
                      <p>✓ Interface sur mesure</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Solution */}
            <div className="px-8 sm:px-12 py-10 border-b border-slate-800/50">
              <div className="text-center mb-8">
                <p className="text-sm font-medium mb-2" style={{ background: 'linear-gradient(135deg, #E14B89, #F8903C)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{l.solutionLabel}</p>
                <h2 className="text-2xl font-bold text-white">{l.solutionTitle}</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { icon: '📊', title: l.f1t, desc: l.f1d },
                  { icon: '📄', title: l.f2t, desc: l.f2d },
                  { icon: '📅', title: l.f3t, desc: l.f3d },
                  { icon: '👥', title: l.f4t, desc: l.f4d },
                  { icon: '⚙️', title: l.f5t, desc: l.f5d },
                  { icon: '🔒', title: l.f6t, desc: l.f6d },
                ].map((f, i) => (
                  <div key={i} className="bg-slate-800/30 border border-slate-800 rounded-xl p-5">
                    <span className="text-2xl mb-3 block">{f.icon}</span>
                    <h3 className="text-white font-semibold text-sm mb-1.5">{f.title}</h3>
                    <p className="text-slate-400 text-xs leading-relaxed">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Fonctionnalités */}
            <div className="px-8 sm:px-12 py-10 border-b border-slate-800/50">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-white">{l.unlimitedTitle}</h2>
                <p className="text-slate-400 text-sm mt-1">{l.unlimitedSub}</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[l.fl1, l.fl2, l.fl3, l.fl4, l.fl5, l.fl6, l.fl7, l.fl8, l.fl9, l.fl10, l.fl11, l.fl12].map((f, i) => (
                  <div key={i} className="flex items-center gap-2.5 bg-slate-800/20 border border-slate-800/50 rounded-lg px-3 py-3">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'linear-gradient(135deg, #E14B89, #F8903C)' }} />
                    <span className="text-slate-300 text-xs">{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ownership */}
            <div className="px-8 sm:px-12 py-10 border-b border-slate-800/50">
              <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-green-400 text-xl">✓</span>
                </div>
                <p className="text-white text-xl font-semibold mb-3">{l.ownerTitle}</p>
                <p className="text-slate-400 text-sm max-w-lg mx-auto leading-relaxed">{l.ownerDesc}</p>
              </div>
            </div>

            {/* Chiffres clés */}
            <div className="px-8 sm:px-12 py-12 border-b border-slate-800/50" style={{ background: 'linear-gradient(180deg, rgba(225,75,137,0.03) 0%, transparent 100%)' }}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
                <div>
                  <div className="text-4xl font-bold mb-2" style={{ background: 'linear-gradient(135deg, #E14B89, #F8903C)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{l.delay}</div>
                  <p className="text-slate-400 text-xs">{l.delayLabel}</p>
                </div>
                <div>
                  <div className="text-4xl font-bold text-white mb-2">{l.custom}</div>
                  <p className="text-slate-400 text-xs">{l.customLabel}</p>
                </div>
                <div>
                  <div className="text-4xl font-bold text-white mb-2">24/7</div>
                  <p className="text-slate-400 text-xs">{plaqLang === 'fr' ? 'Accessible partout' : plaqLang === 'en' ? 'Accessible everywhere' : 'Accesible en todo lugar'}</p>
                </div>
              </div>
            </div>

            {/* Process */}
            <div className="px-8 sm:px-12 py-10 border-b border-slate-800/50">
              <h2 className="text-xl font-bold text-white text-center mb-8">{l.howTitle}</h2>
              <div className="space-y-0">
                {[
                  { step: '01', title: l.s1t, desc: l.s1d },
                  { step: '02', title: l.s2t, desc: l.s2d },
                  { step: '03', title: l.s3t, desc: l.s3d },
                  { step: '04', title: l.s4t, desc: l.s4d },
                ].map((s, i) => (
                  <div key={i} className="flex items-start gap-5">
                    <div className="flex flex-col items-center">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg, #E14B89, #F8903C)' }}>
                        {s.step}
                      </div>
                      {i < 3 && <div className="w-px h-8 bg-slate-800 mt-1" />}
                    </div>
                    <div className="pb-6">
                      <h3 className="text-white font-semibold text-sm">{s.title}</h3>
                      <p className="text-slate-400 text-xs mt-1 leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Technologies */}
            <div className="px-8 sm:px-12 py-10 border-b border-slate-800/50">
              <p className="text-center text-slate-500 text-xs mb-5">{plaqLang === 'fr' ? 'Technologies utilisées' : plaqLang === 'en' ? 'Technologies used' : 'Tecnologias utilizadas'}</p>
              <div className="flex flex-wrap justify-center gap-3">
                {['Next.js', 'React', 'TypeScript', 'PostgreSQL', 'Prisma', 'Tailwind CSS', 'Vercel'].map(tech => (
                  <span key={tech} className="px-4 py-2 bg-slate-800/40 border border-slate-800 rounded-lg text-slate-400 text-xs font-medium">{tech}</span>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="px-8 sm:px-12 py-8 text-center">
              <p className="text-slate-600 text-xs">{l.footer1}</p>
              <p className="text-slate-700 text-xs mt-1">{l.footer2}</p>
            </div>
          </div>
        </div>
        )
      })()}
    </div>
  )
}

// ===========================================================================
// Sub-components
// ===========================================================================

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

function ModalActions({ onCancel, submitLabel }: { onCancel: () => void; submitLabel: string }) {
  return (
    <div className="flex gap-3 pt-2">
      <button type="button" onClick={onCancel} className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors">
        Annuler
      </button>
      <button type="submit" className="flex-1 bg-gradient-to-r from-[#E14B89] to-[#F8903C] hover:opacity-90 text-white py-2.5 rounded-xl text-sm font-medium transition-opacity">
        {submitLabel}
      </button>
    </div>
  )
}

function RelanceSection({
  title,
  relances,
  onToggle,
  onDelete,
  emptyText,
  dimmed,
}: {
  title: string
  relances: Relance[]
  onToggle: (r: Relance) => void
  onDelete: (id: string) => void
  emptyText: string
  dimmed?: boolean
}) {
  return (
    <div className="mb-8">
      <h3 className={`text-sm font-medium mb-3 ${dimmed ? 'text-slate-600' : 'text-white'}`}>{title} ({relances.length})</h3>
      {relances.length === 0 ? (
        <p className="text-slate-600 text-xs py-4">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {relances.map(r => {
            const config = RELANCE_TYPE_CONFIG[r.type] ?? RELANCE_TYPE_CONFIG.APPEL
            const Icon = config.icon
            return (
              <div key={r.id} className={`bg-[#111118] border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors group ${dimmed ? 'opacity-60' : ''}`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <button onClick={() => onToggle(r)} className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${r.done ? 'bg-green-500 border-green-500' : 'border-slate-700 bg-[#1a1a24] hover:border-slate-500'}`}>
                      {r.done && <Check size={12} className="text-white" />}
                    </button>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium flex-shrink-0 ${config.color}`}>
                      <Icon size={12} className="inline mr-1" />
                      {config.label}
                    </span>
                    <span className="text-white text-sm truncate">{r.prospect?.name}</span>
                    {r.prospect?.company && <span className="text-slate-600 text-xs hidden sm:block">({r.prospect.company})</span>}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-slate-500 text-xs">{formatDate(r.date)}</span>
                    {r.notes && <span className="text-slate-600 text-xs hidden md:block max-w-[150px] truncate" title={r.notes}>{r.notes}</span>}
                    <button onClick={() => onDelete(r.id)} className="p-1.5 text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
