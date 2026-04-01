'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { usePolling } from '@/hooks/usePolling'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Trash2, CheckCircle2, Save, Pencil, ExternalLink,
  FileText, X, Globe, Figma, Upload, ChevronDown, ChevronRight,
  FileCheck, Info, Palette, Scale, FolderOpen, Link2, Maximize2,
  LayoutDashboard, AlertTriangle, Users2, ClipboardList, ClipboardCopy,
  Send, Loader2, Clock, DollarSign, MessageSquare, Megaphone, Paintbrush, Lock, Unlock, KeyRound, Mail, Download,
} from 'lucide-react'
import {
  PROJECT_STATUS_COLORS, PROJECT_STATUS_LABELS, PROJECT_TYPE_COLORS, PROJECT_TYPE_LABELS,
  ROLE_AVATAR_COLORS, ROLE_LABELS, MISSION_STATUS_COLORS, MISSION_STATUS_LABELS,
  formatCurrency, formatDate,
} from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Task {
  id: string; title: string; description?: string; status: string; priority: string
  dueDate?: string; assignee?: { id: string; name: string }
}
interface Invoice {
  id: string; filename: string; fileUrl: string; amount?: number; notes?: string
  createdAt: string; uploader: { id: string; name: string }
  assigneeId?: string | null; assignee?: { id: string; name: string; role: string; avatar?: string } | null
}
interface ProjectUser {
  id: string; name: string; role: string; avatar?: string
}
interface ProjectAssignment {
  id: string
  projectId: string
  userId: string
  price?: number | null
  delayDays?: number | null
  deadline?: string | null
  status: string
  counterPrice?: number | null
  counterDeadline?: string | null
  counterNote?: string | null
  respondedAt?: string | null
  createdAt?: string
  user: { id: string; name: string; email: string; role: string; avatar?: string }
}
interface ProjectDoc {
  id: string; name: string; url: string; category: string
  createdAt: string; uploadedBy: { id: string; name: string }
}
interface Project {
  id: string; name: string; type: string; status: string; price?: number
  deadline?: string; startDate?: string; signedAt?: string; services: string[]; notes?: string
  clientBrief?: string | null
  figmaUrl?: string | null; contentUrl?: string | null
  maintenancePlan?: string; maintenancePrice?: number | null
  maintenanceStart?: string | null; maintenanceEnd?: string | null
  formBypassedAt?: string | null
  client: { id: string; name: string; company?: string; website?: string }
  tasks: Task[]; createdBy: { id: string; name: string }
  assignments: ProjectAssignment[]; documents: ProjectDoc[]
  clientForm?: {
    token: string; slug?: string | null; cdcCompleted: boolean; docsCompleted: boolean; briefCompleted: boolean; designCompleted: boolean; accesCompleted: boolean
    cdcData?: Record<string, unknown> | null; briefData?: Record<string, unknown> | null; designData?: Record<string, unknown> | null; accesData?: Record<string, unknown> | null; docsData?: Record<string, unknown> | null
  } | null
}

interface CdcFormData {
  siteType?: string; isRefonte?: boolean; siteActuel?: string; arborescence?: string; espaceClient?: boolean
  fonctionnalites?: string[]; formulaireChamps?: string; catalogueInfo?: string; livraisonInfo?: string; paiementInfo?: string; autresInfos?: string
  // Branding fields
  styleSouhaite?: string; exemplesMarques?: string; couleurs?: string; ambiance?: string
}

interface BriefFormData {
  offreResume?: string; offreDetail?: string; fourchettePrix?: string
  differenciation?: string; usp?: string
  personaTypes?: string; personaPeurs?: string; parcoursAchat?: string
  toneOfVoice?: string; valeurs?: string; sujetsInterdits?: string
  termesInterdits?: string; documentationInterne?: string
  contactEmail?: string; contactPhone?: string
}

interface DesignFormData {
  fond?: string; formes?: string; stylesSouhaites?: string[]
  styleSouhaite?: string; sitesExemple?: string; contactEmail?: string; contactPhone?: string
}

interface AccesFormData {
  emailPro?: string; emailProMdp?: string
  facebook?: string; instagram?: string; linkedin?: string
  calendlyAcces?: string; stripeAcces?: string; autresAcces?: string
}

interface DocsFormData {
  categories: Record<string, { name: string; url: string; filename: string; size: number }[]>
  notes?: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_ORDER = ['BRIEF', 'REDACTION', 'MAQUETTE', 'DEVELOPPEMENT', 'INTEGRATION', 'OPTIMISATIONS', 'TESTING', 'CONCEPTION', 'REVIEW', 'LIVRAISON', 'MAINTENANCE', 'ARCHIVE']

const CDC_FONCTIONNALITES = ['Blog', 'Traduction multilingue', 'Newsletter', 'RDV Calendly', 'Système de réservation', 'Simulateur', 'Livechat', 'Formulaire']

const PIPELINE_BY_PRESTATION: Record<string, string[]> = {
  'Site web': ['REDACTION', 'MAQUETTE', 'INTEGRATION', 'OPTIMISATIONS', 'TESTING', 'LIVRAISON'],
  'Web app': ['MAQUETTE', 'DEVELOPPEMENT', 'TESTING', 'LIVRAISON'],
  'Branding': ['CONCEPTION', 'LIVRAISON'],
}

const ROLE_TO_STAGE_BY_PRESTATION: Record<string, Record<string, string>> = {
  'Site web': { REDACTEUR: 'REDACTION', DESIGNER: 'MAQUETTE', DEVELOPER: 'INTEGRATION' },
  'Web app': { DESIGNER: 'MAQUETTE', DEVELOPER: 'DEVELOPPEMENT' },
  'Branding': { DESIGNER: 'CONCEPTION' },
}

const ROLE_PRIORITY: Record<string, number> = { REDACTEUR: 1, DESIGNER: 2, DEVELOPER: 3, ADMIN: 0, COMMERCIAL: 4 }

const DOC_CATEGORIES = [
  { key: 'CHARTE_GRAPHIQUE',   label: 'Identité visuelle',  icon: Palette,    color: 'text-pink-400'   },
  { key: 'CONTENU_CLIENT',     label: 'Contenu du client',  icon: FileCheck,  color: 'text-teal-400'   },
  { key: 'DOCUMENT_LEGAL',     label: 'Documents légaux',   icon: Scale,      color: 'text-amber-400'  },
  { key: 'AUTRE',              label: 'Autres',              icon: FolderOpen, color: 'text-slate-400'  },
]

type TabId = 'avancement' | 'cdc' | 'brief' | 'design' | 'acces' | 'documents' | 'liens' | 'equipe' | 'factures'

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'avancement',  label: 'Avancement',  icon: LayoutDashboard },
  { id: 'cdc',         label: 'Mission',      icon: ClipboardList    },
  { id: 'brief',       label: 'Brief',        icon: Megaphone        },
  { id: 'design',      label: 'Design',       icon: Paintbrush       },
  { id: 'acces',       label: 'Accès',        icon: KeyRound         },
  { id: 'documents',   label: 'Documents',    icon: Upload           },
  { id: 'liens',       label: 'Liens',        icon: Link2            },
  { id: 'equipe',      label: 'Équipe',       icon: Users2           },
  { id: 'factures',    label: 'Factures',     icon: FileText         },
]

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { data: session } = useSession()

  const [project, setProject]   = useState<Project | null>(null)
  const [users, setUsers]       = useState<ProjectUser[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [activeTab, setActiveTab] = useState<TabId>('avancement')

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<Project & { price: string; deadline: string }>>({})

  // Client brief inline editing
  const [editingClientBrief, setEditingClientBrief] = useState(false)
  const [clientBriefDraft, setClientBriefDraft] = useState('')

  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [showDocModal, setShowDocModal]         = useState(false)
  const [invoiceTargetAssignee, setInvoiceTargetAssignee] = useState<ProjectUser | null>(null)
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null)

  const [invoiceForm, setInvoiceForm] = useState({ filename: '', fileUrl: '', amount: '', notes: '' })
  const [docForm, setDocForm]         = useState({ name: '', url: '', category: 'CHARTE_GRAPHIQUE' })

  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false)
  const [maintenanceForm, setMaintenanceForm] = useState({
    plan: 'HEBERGEMENT', price: '', start: '', end: '',
  })
  const [maintenanceSubmitting, setMaintenanceSubmitting] = useState(false)

  const [showStepBackModal, setShowStepBackModal] = useState(false)
  const [stepBackTarget, setStepBackTarget] = useState<string | null>(null)

  const [formToken, setFormToken] = useState<string | null>(null)
  const [formSlug, setFormSlug] = useState<string | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [copiedLink, setCopiedLink] = useState<'cdc' | 'form' | null>(null)
  const [showFormPopover, setShowFormPopover] = useState(false)
  const [formStatus, setFormStatus] = useState<{ cdcCompleted: boolean; docsCompleted: boolean; briefCompleted: boolean; designCompleted: boolean; accesCompleted: boolean } | null>(null)
  const [cdcFormData, setCdcFormData] = useState<CdcFormData | null>(null)
  const [editingCdc, setEditingCdc] = useState(false)
  const [cdcDraft, setCdcDraft] = useState<CdcFormData | null>(null)
  const [savingCdc, setSavingCdc] = useState(false)
  const [briefFormData, setBriefFormData] = useState<BriefFormData | null>(null)
  const [designFormData, setDesignFormData] = useState<DesignFormData | null>(null)
  const [accesFormData, setAccesFormData] = useState<AccesFormData | null>(null)
  const [docsFormData, setDocsFormData] = useState<DocsFormData | null>(null)

  const [expandedCats, setExpandedCats]     = useState<Record<string, boolean>>({})
  const [figmaExpanded, setFigmaExpanded]   = useState(false)
  const [editingFigma, setEditingFigma]     = useState(false)
  const [editingContent, setEditingContent] = useState(false)
  const [figmaInput, setFigmaInput]         = useState('')
  const [contentInput, setContentInput]     = useState('')

  const [showAddMemberModal, setShowAddMemberModal] = useState(false)
  const [addMemberForm, setAddMemberForm] = useState({ userId: '', price: '', deadline: '' })
  const [addMemberSubmitting, setAddMemberSubmitting] = useState(false)

  const [showCounterModal, setShowCounterModal] = useState(false)
  const [counterForm, setCounterForm] = useState({ price: '', deadline: '', note: '' })
  const [counterSubmitting, setCounterSubmitting] = useState(false)

  const [showEditAssignModal, setShowEditAssignModal] = useState(false)
  const [editAssignTarget, setEditAssignTarget] = useState<ProjectAssignment | null>(null)
  const [editAssignForm, setEditAssignForm] = useState({ price: '', deadline: '' })
  const [editAssignSubmitting, setEditAssignSubmitting] = useState(false)

  const isAdmin  = (session?.user as { role?: string })?.role === 'ADMIN'
  const userRole = (session?.user as { role?: string })?.role ?? ''

  const myAssignment = project?.assignments.find(a => a.userId === session?.user?.id)

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${id}`).then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
      fetch(`/api/projects/${id}/invoices`).then(r => r.json()),
    ]).then(([p, u, inv]) => {
      setProject(p)
      setForm({ ...p, price: p.price?.toString() ?? '', deadline: p.deadline ? p.deadline.split('T')[0] : '', signedAt: p.signedAt ? p.signedAt.slice(0, 7) : '' })
      setUsers(u)
      setInvoices(inv)
      setFigmaInput(p.figmaUrl ?? '')
      setContentInput(p.contentUrl ?? '')
      if (p.clientForm) {
        setFormToken(p.clientForm.token)
        setFormSlug(p.clientForm.slug || p.clientForm.token)
        setFormStatus({ cdcCompleted: p.clientForm.cdcCompleted, docsCompleted: p.clientForm.docsCompleted, briefCompleted: p.clientForm.briefCompleted, designCompleted: p.clientForm.designCompleted, accesCompleted: p.clientForm.accesCompleted })
        if (p.clientForm.cdcData) setCdcFormData(p.clientForm.cdcData as CdcFormData)
        if (p.clientForm.briefData) setBriefFormData(p.clientForm.briefData as BriefFormData)
        if (p.clientForm.designData) setDesignFormData(p.clientForm.designData as DesignFormData)
        if (p.clientForm.accesData) setAccesFormData(p.clientForm.accesData as AccesFormData)
        if (p.clientForm.docsData) setDocsFormData(p.clientForm.docsData as DocsFormData)
      }
    })
  }, [id])

  const refreshData = useCallback(() => {
    Promise.all([
      fetch(`/api/projects/${id}`).then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
      fetch(`/api/projects/${id}/invoices`).then(r => r.json()),
    ]).then(([p, u, inv]) => {
      setProject(p)
      setUsers(u)
      setInvoices(inv)
    })
  }, [id])

  usePolling(refreshData)

  // ── Status click ───────────────────────────────────────────────────────────
  async function handleStatusClick(newStatus: string) {
    if (!project || project.status === newStatus) return
    // Intercept MAINTENANCE: open confirmation modal
    if (newStatus === 'MAINTENANCE') {
      setMaintenanceForm({
        plan: project.maintenancePlan && project.maintenancePlan !== 'NONE' ? project.maintenancePlan : 'HEBERGEMENT',
        price: project.maintenancePrice?.toString() ?? '',
        start: project.maintenanceStart ? project.maintenanceStart.split('T')[0] : new Date().toISOString().split('T')[0],
        end: project.maintenanceEnd ? project.maintenanceEnd.split('T')[0] : '',
      })
      setShowMaintenanceModal(true)
      return
    }
    // Intercept going BACK from MAINTENANCE — require double confirmation
    if (project.status === 'MAINTENANCE') {
      const currentIdx = STATUS_ORDER.indexOf(project.status)
      const targetIdx = STATUS_ORDER.indexOf(newStatus)
      if (targetIdx < currentIdx) {
        setStepBackTarget(newStatus)
        setShowStepBackModal(true)
        return
      }
    }
    const prev = project.status
    setProject(p => p ? { ...p, status: newStatus } : p)
    try {
      await fetch(`/api/projects/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
    } catch {
      setProject(p => p ? { ...p, status: prev } : p)
    }
  }

  async function confirmStepBack() {
    if (!project || !stepBackTarget) return
    const prev = project.status
    setProject(p => p ? { ...p, status: stepBackTarget } : p)
    setShowStepBackModal(false)
    try {
      await fetch(`/api/projects/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: stepBackTarget }),
      })
    } catch {
      setProject(p => p ? { ...p, status: prev } : p)
    }
    setStepBackTarget(null)
  }

  // ── Confirm maintenance ─────────────────────────────────────────────────────
  async function handleConfirmMaintenance(e: React.FormEvent) {
    e.preventDefault()
    if (maintenanceSubmitting || !project) return
    setMaintenanceSubmitting(true)
    try {
      // 1. Update project status + maintenance fields
      await fetch(`/api/projects/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'MAINTENANCE',
          maintenancePlan: maintenanceForm.plan,
          maintenancePrice: maintenanceForm.price || null,
          maintenanceStart: maintenanceForm.start || null,
          maintenanceEnd: maintenanceForm.end || null,
        }),
      })
      // 2. Create a MaintenanceContract (type WEB) in the maintenances page
      const cmsMap: Record<string, string> = { WORDPRESS: 'WordPress', FRAMER: 'Framer', CUSTOM: 'Sur mesure', ECOMMERCE: 'E-commerce' }
      await fetch('/api/maintenances', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: project.client.name,
          url: project.client.website || null,
          cms: cmsMap[project.type] || null,
          type: 'WEB',
          billing: 'MENSUEL',
          priceHT: maintenanceForm.price ? parseFloat(maintenanceForm.price) : null,
          startDate: maintenanceForm.start || null,
          endDate: maintenanceForm.end || null,
          active: true,
        }),
      })
      setProject(p => p ? {
        ...p,
        status: 'MAINTENANCE',
        maintenancePlan: maintenanceForm.plan,
        maintenancePrice: maintenanceForm.price ? parseFloat(maintenanceForm.price) : null,
        maintenanceStart: maintenanceForm.start || null,
        maintenanceEnd: maintenanceForm.end || null,
      } : p)
      setShowMaintenanceModal(false)
    } finally {
      setMaintenanceSubmitting(false)
    }
  }

  // ── Save details ───────────────────────────────────────────────────────────
  async function handleSave() {
    const res = await fetch(`/api/projects/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        price: form.price ? parseFloat(form.price as string) : null,
        deadline: (form.deadline as string) || null,
        signedAt: form.signedAt ? `${form.signedAt}-01` : null,
      }),
    })
    const updated = await res.json()
    setProject(p => p ? { ...p, ...updated } : p)
    setEditing(false)
  }

  async function handleDelete() {
    if (!confirm('Supprimer ce projet ?')) return
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || 'Erreur lors de la suppression')
      return
    }
    router.push('/projects')
  }

  // ── Client Brief ──────────────────────────────────────────────────────────
  async function saveClientBrief() {
    await fetch(`/api/projects/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientBrief: clientBriefDraft || null }),
    })
    setProject(p => p ? { ...p, clientBrief: clientBriefDraft || null } : p)
    setEditingClientBrief(false)
  }

  // ── CDC edit ──────────────────────────────────────────────────────────────
  async function saveCdcData() {
    if (!formToken || !cdcDraft) return
    setSavingCdc(true)
    try {
      await fetch(`/api/formulaire/${formToken}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cdcData: cdcDraft }),
      })
      setCdcFormData(cdcDraft)
      setEditingCdc(false)
    } catch { /* ignore */ }
    setSavingCdc(false)
  }

  // ── Figma / Contenu ────────────────────────────────────────────────────────
  async function saveFigmaUrl() {
    await fetch(`/api/projects/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ figmaUrl: figmaInput }),
    })
    setProject(p => p ? { ...p, figmaUrl: figmaInput || null } : p)
    setEditingFigma(false)
  }

  async function saveContentUrl() {
    await fetch(`/api/projects/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentUrl: contentInput }),
    })
    setProject(p => p ? { ...p, contentUrl: contentInput || null } : p)
    setEditingContent(false)
  }

  // ── Client Form ──────────────────────────────────────────────────────────
  const [cdcGenerating, setCdcGenerating] = useState(false)
  const [cdcDropdown, setCdcDropdown] = useState(false)
  const cdcDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (cdcDropdownRef.current && !cdcDropdownRef.current.contains(e.target as Node)) setCdcDropdown(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleDownloadCDC(format: 'pdf' | 'png' = 'pdf') {
    if (!project) return
    setCdcGenerating(true)
    try {
      const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib')
      const pdf = await PDFDocument.create()
      const font = await pdf.embedFont(StandardFonts.Helvetica)
      const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)

      const pink = rgb(0.882, 0.294, 0.537)
      const white = rgb(1, 1, 1)
      const gray = rgb(0.5, 0.5, 0.55)
      const dark = rgb(0.12, 0.12, 0.16)
      const PAGE_W = 595
      const PAGE_H = 842
      const MARGIN = 50
      const MAX_W = PAGE_W - MARGIN * 2
      let page = pdf.addPage([PAGE_W, PAGE_H])
      let y = PAGE_H - MARGIN

      // Sanitize text for WinAnsiEncoding (pdf-lib StandardFonts)
      function sanitize(str: unknown): string {
        if (!str) return ''
        const s = String(str)
        return s
          .replace(/[\u2018\u2019]/g, "'")
          .replace(/[\u201C\u201D]/g, '"')
          .replace(/\u2026/g, '...')
          .replace(/\u2013/g, '-')
          .replace(/\u2014/g, '--')
          .replace(/\u00A0/g, ' ')
          .replace(/[\r]/g, '')
          // eslint-disable-next-line no-control-regex
          .replace(/[^\x20-\xFF\n]/g, '')
      }

      function newPage() {
        page = pdf.addPage([PAGE_W, PAGE_H])
        page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: dark })
        y = PAGE_H - MARGIN
      }

      function checkY(need: number) {
        if (y - need < MARGIN) newPage()
      }

      function drawTitle(text: string) {
        text = sanitize(text).replace(/\n/g, '')
        checkY(26)
        y -= 4
        page.drawRectangle({ x: MARGIN - 5, y: y - 8, width: MAX_W + 10, height: 22, color: rgb(0.08, 0.08, 0.1), borderColor: rgb(0.2, 0.2, 0.25), borderWidth: 0.5 })
        page.drawText(text, { x: MARGIN + 5, y: y - 3, size: 10, font: fontBold, color: pink })
        y -= 22
      }

      function drawLabel(label: string, value: string) {
        if (!value || value === 'undefined') return
        label = sanitize(label)
        value = sanitize(value).replace(/\n/g, ' ')
        checkY(13)
        page.drawText(label + ' :', { x: MARGIN, y, size: 7.5, font: fontBold, color: gray })
        const words = value.split(' ')
        let line = ''
        let firstLine = true
        for (const word of words) {
          const test = line ? line + ' ' + word : word
          if (font.widthOfTextAtSize(test, 8.5) > MAX_W - 110) {
            page.drawText(line, { x: MARGIN + 110, y, size: 8.5, font, color: white })
            y -= 12
            checkY(12)
            line = word
            firstLine = false
          } else {
            line = test
          }
        }
        if (line) {
          page.drawText(line, { x: firstLine ? MARGIN + 110 : MARGIN + 110, y, size: 8.5, font, color: white })
          y -= 13
        }
      }

      function drawText(text: string) {
        if (!text) return
        text = sanitize(text)
        const lines = text.split('\n')
        for (const rl of lines) {
          const rawLine = rl.replace(/\n/g, '').trim()
          if (!rawLine) { y -= 4; continue }
          const words = rawLine.split(' ')
          let line = ''
          for (const word of words) {
            const test = line ? line + ' ' + word : word
            if (font.widthOfTextAtSize(test, 8.5) > MAX_W) {
              checkY(12)
              page.drawText(line, { x: MARGIN, y, size: 8.5, font, color: rgb(0.75, 0.75, 0.78) })
              y -= 12
              line = word
            } else {
              line = test
            }
          }
          if (line) {
            checkY(12)
            page.drawText(line, { x: MARGIN, y, size: 8.5, font, color: rgb(0.75, 0.75, 0.78) })
            y -= 12
          }
        }
        y -= 2
      }

      // ── Cover ──
      page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: dark })
      const s = (v: unknown) => sanitize(v).replace(/\n/g, ' ')
      page.drawText('CAHIER DES CHARGES', { x: MARGIN, y: PAGE_H / 2 + 40, size: 28, font: fontBold, color: pink })
      page.drawText(s(project.name), { x: MARGIN, y: PAGE_H / 2, size: 18, font: fontBold, color: white })
      page.drawText(s(project.client.company || project.client.name), { x: MARGIN, y: PAGE_H / 2 - 25, size: 12, font, color: gray })
      page.drawText(s(`Type : ${PROJECT_TYPE_LABELS[project.type] || project.type}`), { x: MARGIN, y: PAGE_H / 2 - 50, size: 10, font, color: gray })
      page.drawText('Agence Kameo', { x: MARGIN, y: MARGIN + 20, size: 10, font: fontBold, color: pink })
      page.drawText(new Date().toLocaleDateString('fr-FR'), { x: MARGIN, y: MARGIN, size: 9, font, color: gray })

      // ── Section helper: start new section, only new page if < 80px left ──
      function section(title: string) {
        if (y < MARGIN + 80) newPage()
        else y -= 8 // small gap between sections
        drawTitle(title)
      }

      // ── Mission (CDC) ──
      newPage()
      const cdc = (project.clientForm?.cdcData || {}) as CdcFormData
      drawTitle('MISSION')
      drawLabel('Type de site', cdc.siteType === 'ECOMMERCE' ? 'E-commerce' : cdc.siteType === 'VITRINE' ? 'Site vitrine' : cdc.siteType || '')
      drawLabel('Refonte', cdc.isRefonte ? 'Oui' : 'Non')
      if (cdc.siteActuel) drawLabel('Site actuel', cdc.siteActuel)
      if (cdc.arborescence) { drawLabel('Arborescence', ''); drawText(cdc.arborescence) }
      drawLabel('Espace client', cdc.espaceClient ? 'Oui' : 'Non')
      if (cdc.fonctionnalites?.length) drawLabel('Fonctionnalites', cdc.fonctionnalites.join(', '))
      if (cdc.formulaireChamps) drawLabel('Champs formulaire', cdc.formulaireChamps)
      if (cdc.catalogueInfo) { drawLabel('Catalogue', ''); drawText(cdc.catalogueInfo) }
      if (cdc.livraisonInfo) drawLabel('Livraison', cdc.livraisonInfo)
      if (cdc.paiementInfo) drawLabel('Paiement', cdc.paiementInfo)
      if (cdc.autresInfos) { drawLabel('Infos complementaires', ''); drawText(cdc.autresInfos) }

      // ── Brief ──
      const brief = (project.clientForm?.briefData || {}) as BriefFormData
      if (Object.values(brief).some(v => v)) {
        section('BRIEF')
        if (brief.offreResume) { drawLabel('Resume offre', ''); drawText(brief.offreResume) }
        if (brief.offreDetail) { drawLabel('Detail offre', ''); drawText(brief.offreDetail) }
        if (brief.fourchettePrix) drawLabel('Fourchette de prix', brief.fourchettePrix)
        if (brief.differenciation) { drawLabel('Differenciation', ''); drawText(brief.differenciation) }
        if (brief.usp) drawLabel('USP', brief.usp)
        if (brief.personaTypes) { drawLabel('Personas', ''); drawText(brief.personaTypes) }
        if (brief.personaPeurs) { drawLabel('Peurs / objections', ''); drawText(brief.personaPeurs) }
        if (brief.parcoursAchat) { drawLabel('Parcours d\'achat', ''); drawText(brief.parcoursAchat) }
        if (brief.toneOfVoice) drawLabel('Ton de voix', brief.toneOfVoice)
        if (brief.valeurs) drawLabel('Valeurs', brief.valeurs)
        if (brief.sujetsInterdits) drawLabel('Sujets interdits', brief.sujetsInterdits)
        if (brief.termesInterdits) drawLabel('Termes interdits', brief.termesInterdits)
      }

      // ── Design ──
      const design = (project.clientForm?.designData || {}) as DesignFormData
      if (Object.values(design).some(v => v)) {
        section('DESIGN')
        if (design.fond) drawLabel('Fond', design.fond === 'clair' ? 'Clair' : 'Sombre')
        if (design.formes) drawLabel('Formes', design.formes === 'arrondis' ? 'Arrondies' : 'Carrees')
        if (design.stylesSouhaites?.length) drawLabel('Styles souhaites', design.stylesSouhaites.join(', '))
        if (design.styleSouhaite) drawLabel('Style souhaite', design.styleSouhaite)
        if (design.sitesExemple) { drawLabel('Sites d\'exemple', ''); drawText(design.sitesExemple) }
      }

      // ── Acces ──
      const acces = (project.clientForm?.accesData || {}) as AccesFormData
      if (Object.values(acces).some(v => v)) {
        section('ACCES')
        if (acces.emailPro) drawLabel('Email pro', acces.emailPro)
        if (acces.emailProMdp) drawLabel('Mot de passe email', acces.emailProMdp)
        if (acces.facebook) drawLabel('Facebook', acces.facebook)
        if (acces.instagram) drawLabel('Instagram', acces.instagram)
        if (acces.linkedin) drawLabel('LinkedIn', acces.linkedin)
        if (acces.calendlyAcces) drawLabel('Calendly', acces.calendlyAcces)
        if (acces.stripeAcces) drawLabel('Stripe', acces.stripeAcces)
        if (acces.autresAcces) { drawLabel('Autres acces', ''); drawText(acces.autresAcces) }
      }

      // ── Documents ──
      const docs = (project.clientForm?.docsData || {}) as unknown as DocsFormData
      if (docs.categories && Object.keys(docs.categories).length > 0) {
        section('DOCUMENTS')
        for (const [cat, files] of Object.entries(docs.categories)) {
          if (!files?.length) continue
          checkY(16)
          page.drawText(s(cat), { x: MARGIN, y, size: 9, font: fontBold, color: white })
          y -= 13
          for (const f of files) {
            checkY(12)
            page.drawText(s(`  ${f.name || f.filename}`), { x: MARGIN + 8, y, size: 8, font, color: gray })
            y -= 11
          }
          y -= 3
        }
        if (docs.notes) { drawLabel('Notes', ''); drawText(docs.notes) }
      }

      // ── Notes projet ──
      if (project.notes || project.clientBrief) {
        section('NOTES')
        if (project.clientBrief) { drawLabel('Brief client', ''); drawText(project.clientBrief) }
        if (project.notes) { drawLabel('Notes internes', ''); drawText(project.notes) }
      }

      const bytes = await pdf.save()
      const fileName = `CDC-${project.name.replace(/\s+/g, '-')}`

      if (format === 'png') {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
        const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise
        const totalPages = pdfDoc.numPages
        const scale = 2
        // Render all pages, then stitch into one tall canvas
        const pageCanvases: HTMLCanvasElement[] = []
        let totalHeight = 0
        let maxWidth = 0
        for (let i = 1; i <= totalPages; i++) {
          const pdfPage = await pdfDoc.getPage(i)
          const viewport = pdfPage.getViewport({ scale })
          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          const ctx = canvas.getContext('2d')!
          await pdfPage.render({ canvasContext: ctx, viewport }).promise
          pageCanvases.push(canvas)
          totalHeight += viewport.height
          if (viewport.width > maxWidth) maxWidth = viewport.width
        }
        // Combine into single canvas
        const finalCanvas = document.createElement('canvas')
        finalCanvas.width = maxWidth
        finalCanvas.height = totalHeight
        const finalCtx = finalCanvas.getContext('2d')!
        let y = 0
        for (const pc of pageCanvases) {
          finalCtx.drawImage(pc, 0, y)
          y += pc.height
        }
        const link = document.createElement('a')
        link.href = finalCanvas.toDataURL('image/png')
        link.download = `${fileName}.png`
        link.click()
      } else {
        const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${fileName}.pdf`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error('CDC error:', err)
      alert(`Erreur lors de la génération: ${err instanceof Error ? err.message : String(err)}`)
    }
    setCdcGenerating(false)
    setCdcDropdown(false)
  }

  async function handleOpenFormPopover() {
    setShowFormPopover(true)
    if (formToken) return // already loaded
    setFormLoading(true)
    try {
      const res = await fetch(`/api/projects/${id}/form`)
      const data = await res.json()
      setFormToken(data.token)
      setFormSlug(data.slug || data.token)
      setFormStatus({ cdcCompleted: data.cdcCompleted, docsCompleted: data.docsCompleted, briefCompleted: data.briefCompleted, designCompleted: data.designCompleted, accesCompleted: data.accesCompleted })
      if (data.cdcData) setCdcFormData(data.cdcData as CdcFormData)
      if (data.briefData) setBriefFormData(data.briefData as BriefFormData)
      if (data.designData) setDesignFormData(data.designData as DesignFormData)
      if (data.accesData) setAccesFormData(data.accesData as AccesFormData)
      if (data.docsData) setDocsFormData(data.docsData as DocsFormData)
    } catch { /* ignore */ }
    setFormLoading(false)
  }

  function copyLink(section: 'cdc' | 'form') {
    if (!formToken) return
    const url = `${window.location.origin}/formulaire/${formSlug || formToken}?section=${section}`
    navigator.clipboard.writeText(url)
    setCopiedLink(section)
    setTimeout(() => setCopiedLink(null), 2000)
  }

  // ── Assignees ──────────────────────────────────────────────────────────────
  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault()
    if (addMemberSubmitting || !addMemberForm.userId) return
    setAddMemberSubmitting(true)
    try {
      let deadlineDate: string | null = null
      if (addMemberForm.deadline) {
        const days = parseInt(addMemberForm.deadline)
        if (!isNaN(days) && days > 0) {
          // Find the latest deadline of freelancers with lower role priority (sequential workflow)
          const selectedUser = users.find(u => u.id === addMemberForm.userId)
          const selectedPriority = ROLE_PRIORITY[selectedUser?.role ?? ''] ?? 99
          const sorted = [...(project?.assignments ?? [])].sort((a, b) => (ROLE_PRIORITY[a.user.role] ?? 99) - (ROLE_PRIORITY[b.user.role] ?? 99))
          const prevAssignment = sorted.filter(a => (ROLE_PRIORITY[a.user.role] ?? 99) < selectedPriority).pop()
          const startFrom = prevAssignment?.deadline ? new Date(prevAssignment.deadline) : new Date()
          const d = new Date(startFrom)
          d.setDate(d.getDate() + days)
          deadlineDate = d.toISOString()
        }
      }
      const res = await fetch(`/api/projects/${id}/assignees`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: addMemberForm.userId,
          price: addMemberForm.price ? parseFloat(addMemberForm.price) : null,
          deadline: deadlineDate,
        }),
      })
      if (res.ok) {
        const assignment = await res.json()
        setProject(prev => prev ? { ...prev, assignments: [...prev.assignments, assignment] } : prev)
        setShowAddMemberModal(false)
        setAddMemberForm({ userId: '', price: '', deadline: '' })
      }
    } finally { setAddMemberSubmitting(false) }
  }

  async function handleRemoveAssignee(userId: string) {
    await fetch(`/api/projects/${id}/assignees`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }),
    })
    setProject(prev => prev ? { ...prev, assignments: prev.assignments.filter(a => a.userId !== userId) } : prev)
  }

  async function handleRespondMission(action: 'accept' | 'counter' | 'refuse') {
    if (action === 'counter') {
      setShowCounterModal(true)
      setCounterForm({
        price: myAssignment?.price?.toString() ?? '',
        deadline: myAssignment?.deadline ? myAssignment.deadline.split('T')[0] : '',
        note: '',
      })
      return
    }
    const res = await fetch(`/api/projects/${id}/assignees/respond`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    if (res.ok) {
      const updated = await res.json()
      setProject(prev => prev ? { ...prev, assignments: prev.assignments.map(a => a.userId === updated.userId ? updated : a) } : prev)
    }
  }

  async function handleSubmitCounter(e: React.FormEvent) {
    e.preventDefault()
    setCounterSubmitting(true)
    try {
      const res = await fetch(`/api/projects/${id}/assignees/respond`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'counter',
          counterPrice: counterForm.price ? parseFloat(counterForm.price) : null,
          counterDeadline: counterForm.deadline || null,
          counterNote: counterForm.note || null,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        setProject(prev => prev ? { ...prev, assignments: prev.assignments.map(a => a.userId === updated.userId ? updated : a) } : prev)
        setShowCounterModal(false)
      }
    } finally { setCounterSubmitting(false) }
  }

  async function handleReviewCounter(userId: string, action: 'accept' | 'reject') {
    const res = await fetch(`/api/projects/${id}/assignees/review`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action }),
    })
    if (res.ok) {
      const updated = await res.json()
      setProject(prev => prev ? { ...prev, assignments: prev.assignments.map(a => a.userId === updated.userId ? updated : a) } : prev)
    }
  }

  function openEditAssignModal(a: ProjectAssignment) {
    setEditAssignTarget(a)
    setEditAssignForm({
      price: a.price?.toString() ?? '',
      deadline: a.deadline ? a.deadline.split('T')[0] : '',
    })
    setShowEditAssignModal(true)
  }

  async function handleEditAssignment(e: React.FormEvent) {
    e.preventDefault()
    if (!editAssignTarget) return
    setEditAssignSubmitting(true)
    const payload: Record<string, unknown> = {
      userId: editAssignTarget.userId,
      price: editAssignForm.price ? parseFloat(editAssignForm.price) : null,
      deadline: editAssignForm.deadline || null,
    }
    if (editAssignTarget.status !== 'EN_ATTENTE') {
      payload.status = 'EN_ATTENTE'
    }
    const res = await fetch(`/api/projects/${id}/assignees`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      const updated = await res.json()
      setProject(prev => prev ? { ...prev, assignments: prev.assignments.map(a => a.userId === updated.userId ? updated : a) } : prev)
      setShowEditAssignModal(false)
    }
    setEditAssignSubmitting(false)
  }

  async function handleResetAssignment(userId: string) {
    if (!confirm('Remettre cette mission en attente ? Le développeur devra à nouveau répondre.')) return
    const res = await fetch(`/api/projects/${id}/assignees`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, status: 'EN_ATTENTE' }),
    })
    if (res.ok) {
      const updated = await res.json()
      setProject(prev => prev ? { ...prev, assignments: prev.assignments.map(a => a.userId === updated.userId ? updated : a) } : prev)
    }
  }

  // ── Invoices ───────────────────────────────────────────────────────────────
  function openInvoiceModal(assignee: ProjectUser, existingInvoice?: Invoice) {
    setInvoiceTargetAssignee(assignee)
    if (existingInvoice) {
      setEditingInvoiceId(existingInvoice.id)
      setInvoiceForm({
        filename: existingInvoice.filename,
        fileUrl: existingInvoice.fileUrl,
        amount: existingInvoice.amount?.toString() ?? '',
        notes: existingInvoice.notes ?? '',
      })
    } else {
      setEditingInvoiceId(null)
      setInvoiceForm({ filename: '', fileUrl: '', amount: '', notes: '' })
    }
    setShowInvoiceModal(true)
  }

  async function handleCreateInvoice(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      ...invoiceForm,
      amount: invoiceForm.amount ? parseFloat(invoiceForm.amount) : null,
      assigneeId: invoiceTargetAssignee?.id ?? null,
    }
    if (editingInvoiceId) {
      // Update existing invoice
      const res = await fetch(`/api/projects/${id}/invoices`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: editingInvoiceId, ...payload }),
      })
      const updated = await res.json()
      setInvoices(prev => prev.map(inv => inv.id === editingInvoiceId ? updated : inv))
    } else {
      // Create new invoice
      const res = await fetch(`/api/projects/${id}/invoices`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const invoice = await res.json()
      setInvoices(prev => [invoice, ...prev])
    }
    setShowInvoiceModal(false)
    setInvoiceTargetAssignee(null)
    setEditingInvoiceId(null)
    setInvoiceForm({ filename: '', fileUrl: '', amount: '', notes: '' })
  }

  async function handleDeleteInvoice(invoiceId: string) {
    if (!confirm('Supprimer cette facture ?')) return
    await fetch(`/api/projects/${id}/invoices`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId }),
    })
    setInvoices(prev => prev.filter(inv => inv.id !== invoiceId))
  }

  // ── Documents ─────────────────────────────────────────────────────────────
  async function handleCreateDoc(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch(`/api/projects/${id}/documents`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(docForm),
    })
    const doc = await res.json()
    setProject(prev => prev ? { ...prev, documents: [doc, ...prev.documents] } : prev)
    setShowDocModal(false)
    setDocForm({ name: '', url: '', category: 'CHARTE_GRAPHIQUE' })
  }

  async function handleDeleteDoc(docId: string) {
    await fetch(`/api/projects/${id}/documents`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docId }),
    })
    setProject(prev => prev ? { ...prev, documents: prev.documents.filter(d => d.id !== docId) } : prev)
  }

  function toggleCat(key: string) {
    setExpandedCats(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (!project) return (
    <div className="px-6 lg:px-10 pt-6 animate-pulse">
      <div className="h-3 bg-slate-800 rounded-full w-28 mb-5" />
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-7 bg-slate-800 rounded-full w-60" />
            <div className="h-6 bg-slate-800 rounded-full w-20" />
          </div>
          <div className="h-4 bg-slate-800 rounded-full w-44" />
        </div>
        <div className="h-9 bg-slate-800 rounded-xl w-28" />
      </div>
      <div className="h-12 bg-slate-800 rounded-2xl mb-5" />
      <div className="h-10 bg-slate-800/50 rounded-2xl mb-6 w-80" />
      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 space-y-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-14 bg-slate-800/40 rounded-xl" />)}
        </div>
        <div className="space-y-4">
          {[1, 2].map(i => <div key={i} className="h-40 bg-slate-800/40 rounded-2xl" />)}
        </div>
      </div>
    </div>
  )

  const unassignedUsers = users.filter(u => !project.assignments.find(a => a.userId === u.id))
  const getFigmaEmbedUrl = (url: string) => `https://www.figma.com/embed?embed_host=kameo&url=${encodeURIComponent(url)}`
  const canEditContent  = isAdmin || userRole === 'REDACTEUR'
  const canEditFigma    = isAdmin || userRole === 'DESIGNER'

  return (
    <div className="flex flex-col min-h-screen">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-6 lg:px-10 pt-6 pb-5 border-b border-slate-800/60">
        {/* Back link */}
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-slate-500 hover:text-white text-xs mb-5 transition-colors"
        >
          <ArrowLeft size={13} /> Retour aux projets
        </Link>

        {/* Row 1: Title + actions */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <h1 className="text-2xl font-semibold text-white truncate">{project.name}</h1>
          <div className="flex items-center gap-2 flex-shrink-0">
            {editing ? (
              <>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 text-white px-4 py-2 rounded-xl text-sm transition-colors"
                >
                  <Save size={14} /> Sauvegarder
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="border border-slate-700 text-slate-400 hover:text-white p-2 rounded-xl transition-colors"
                >
                  <X size={14} />
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-2 border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-white px-4 py-2 rounded-xl text-sm transition-colors"
              >
                <Pencil size={14} /> Modifier
              </button>
            )}
            {/* CDC download button */}
            <div className="relative" ref={cdcDropdownRef}>
              <button onClick={() => setCdcDropdown(!cdcDropdown)} disabled={cdcGenerating}
                className="flex items-center gap-2 border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-white px-4 py-2 rounded-xl text-sm transition-colors disabled:opacity-50">
                {cdcGenerating ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                CDC
                <ChevronDown size={12} />
              </button>
              {cdcDropdown && !cdcGenerating && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setCdcDropdown(false)} />
                  <div className="absolute right-0 top-full mt-1 bg-[#111118] border border-slate-700 rounded-xl overflow-hidden shadow-xl z-50 min-w-[160px]">
                    <button onClick={() => handleDownloadCDC('pdf')}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors text-sm">
                      <FileText size={14} className="text-red-400" /> PDF
                    </button>
                    <button onClick={() => handleDownloadCDC('png')}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors text-sm">
                      <Maximize2 size={14} className="text-blue-400" /> PNG (images)
                    </button>
                  </div>
                </>
              )}
            </div>
            {/* Formulaire client button */}
            <div className="relative">
              <button
                onClick={handleOpenFormPopover}
                className="flex items-center gap-2 bg-gradient-to-r from-[#E14B89] to-[#F8903C] hover:opacity-90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-opacity"
              >
                <Send size={14} /> Formulaire
              </button>
              {showFormPopover && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowFormPopover(false)} />
                  <div className="absolute right-0 top-full mt-2 w-96 bg-[#111118] border border-slate-800 rounded-2xl p-5 shadow-2xl z-50">
                    <h3 className="text-white font-semibold text-sm mb-1">Formulaires client</h3>
                    <p className="text-slate-500 text-xs mb-4">Partagez ces liens séparément au client.</p>
                    {formLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 size={20} className="animate-spin text-[#E14B89]" />
                      </div>
                    ) : formToken ? (
                      <div className="space-y-3">
                        {/* CDC link */}
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <ClipboardList size={12} className="text-[#E14B89]" />
                            <span className="text-white text-xs font-medium">Mission</span>
                            {formStatus?.cdcCompleted && <CheckCircle2 size={11} className="text-emerald-400" />}
                          </div>
                          <div className="flex gap-2">
                            <input readOnly value={`${typeof window !== 'undefined' ? window.location.origin : ''}/formulaire/${formSlug || formToken}?section=cdc`}
                              className="flex-1 bg-[#1a1a24] border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none truncate" />
                            <button onClick={() => copyLink('cdc')}
                              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all flex-shrink-0 ${copiedLink === 'cdc' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-[#E14B89] hover:opacity-90 text-white'}`}>
                              {copiedLink === 'cdc' ? <CheckCircle2 size={12} /> : <ClipboardCopy size={12} />}
                              {copiedLink === 'cdc' ? 'Copié !' : 'Copier'}
                            </button>
                          </div>
                        </div>
                        {/* Formulaire client (Brief + Design + Documents) */}
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <FileText size={12} className="text-blue-400" />
                            <span className="text-white text-xs font-medium">Formulaire projet</span>
                            {formStatus?.briefCompleted && formStatus?.designCompleted && formStatus?.accesCompleted && formStatus?.docsCompleted && <CheckCircle2 size={11} className="text-emerald-400" />}
                          </div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${formStatus?.briefCompleted ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>Brief</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${formStatus?.designCompleted ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>Design</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${formStatus?.accesCompleted ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>Accès</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${formStatus?.docsCompleted ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>Documents</span>
                          </div>
                          <div className="flex gap-2">
                            <input readOnly value={`${typeof window !== 'undefined' ? window.location.origin : ''}/formulaire/${formSlug || formToken}?section=form`}
                              className="flex-1 bg-[#1a1a24] border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none truncate" />
                            <button onClick={() => copyLink('form')}
                              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all flex-shrink-0 ${copiedLink === 'form' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-[#E14B89] hover:opacity-90 text-white'}`}>
                              {copiedLink === 'form' ? <CheckCircle2 size={12} /> : <ClipboardCopy size={12} />}
                              {copiedLink === 'form' ? 'Copié !' : 'Copier'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </>
              )}
            </div>
            {isAdmin && (
              <button
                onClick={handleDelete}
                className="border border-red-900/40 hover:border-red-700 text-red-500 hover:text-red-400 p-2 rounded-xl transition-colors"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Client + badges */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <Link
            href={`/clients/${project.client.id}`}
            className="flex items-center gap-1.5 text-slate-300 hover:text-[#E14B89] transition-colors text-sm font-medium"
          >
            {project.client.name}{project.client.company ? ` · ${project.client.company}` : ''}
            <ExternalLink size={11} className="text-slate-600" />
          </Link>
          <div className="w-px h-4 bg-slate-800" />
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${PROJECT_TYPE_COLORS[project.type]}`}>
            {PROJECT_TYPE_LABELS[project.type]}
          </span>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${PROJECT_STATUS_COLORS[project.status]}`}>
            {PROJECT_STATUS_LABELS[project.status]}
          </span>
        </div>

        {/* Row 3: Key details + team */}
        <div className="flex items-center justify-between gap-4">
          {/* Left: details */}
          {!editing && (
            <div className="flex items-center gap-5 flex-wrap">
              {isAdmin && project.price != null && (
                <div className="flex flex-col">
                  <span className="text-slate-500 text-[10px] uppercase tracking-wider">Budget</span>
                  <span className="text-white font-semibold text-sm">{formatCurrency(project.price)}</span>
                </div>
              )}
              {project.startDate && (
                <div className="flex flex-col">
                  <span className="text-slate-500 text-[10px] uppercase tracking-wider">Début</span>
                  <span className="text-slate-300 text-sm">{formatDate(project.startDate)}</span>
                </div>
              )}
              {project.deadline && (
                <div className="flex flex-col">
                  <span className="text-slate-500 text-[10px] uppercase tracking-wider">Deadline</span>
                  <span className="text-slate-300 text-sm">{formatDate(project.deadline)}</span>
                </div>
              )}
            </div>
          )}

          {/* Right: team avatars */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {project.assignments.length > 0 && (
              <div className="flex items-center">
                {project.assignments.slice(0, 4).map((a, i) => {
                  const gradient = ROLE_AVATAR_COLORS[a.user.role] ?? 'from-slate-400 to-slate-600'
                  return (
                    <div
                      key={a.user.id}
                      title={`${a.user.name} · ${ROLE_LABELS[a.user.role] ?? a.user.role}`}
                      className={`w-8 h-8 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center border-2 border-[#0d0d14] overflow-hidden flex-shrink-0 ${i > 0 ? '-ml-2' : ''}`}
                    >
                      {a.user.avatar
                        ? <img src={a.user.avatar} alt="" className="w-full h-full object-cover" />
                        : <span className="text-white text-xs font-semibold">{a.user.name[0]?.toUpperCase()}</span>
                      }
                    </div>
                  )
                })}
                {project.assignments.length > 4 && (
                  <div className="w-8 h-8 rounded-full bg-slate-700 border-2 border-[#0d0d14] -ml-2 flex items-center justify-center flex-shrink-0">
                    <span className="text-slate-300 text-xs font-medium">+{project.assignments.length - 4}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Tab navigation ─────────────────────────────────────────────────── */}
      <div className="px-6 lg:px-10 border-b border-slate-800">
        <nav className="flex">
          {TABS.map(tab => {
            const Icon = tab.icon
            const formTabCompleted: Record<string, boolean> = {
              brief: !!briefFormData,
              design: !!designFormData,
              acces: !!accesFormData,
              documents: !!docsFormData || project.documents.filter(d => d.category !== 'CAHIER_DES_CHARGES').length > 0,
            }
            const isFormTab = ['brief', 'design', 'acces', 'documents'].includes(tab.id)
            const isWaiting = isFormTab && !formTabCompleted[tab.id]
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-all ${
                  activeTab === tab.id
                    ? 'border-[#E14B89] text-white'
                    : isWaiting
                      ? 'border-transparent text-slate-600 hover:text-slate-400 hover:border-slate-700'
                      : 'border-transparent text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <Icon size={14} className={isWaiting && activeTab !== tab.id ? 'opacity-40' : ''} />
                {tab.label}
                {isWaiting && (
                  <span className="ml-1 text-[10px] bg-amber-500/10 text-amber-500/70 rounded-full px-1.5 py-px">
                    <Clock size={8} className="inline -mt-px mr-0.5" />attente
                  </span>
                )}
                {tab.id === 'brief' && briefFormData && (
                  <span className="ml-1 text-[10px] bg-emerald-400/10 text-emerald-400 rounded-full px-1.5 py-px">
                    <CheckCircle2 size={8} className="inline -mt-px" />
                  </span>
                )}
                {tab.id === 'design' && designFormData && (
                  <span className="ml-1 text-[10px] bg-emerald-400/10 text-emerald-400 rounded-full px-1.5 py-px">
                    <CheckCircle2 size={8} className="inline -mt-px" />
                  </span>
                )}
                {tab.id === 'acces' && accesFormData && (
                  <span className="ml-1 text-[10px] bg-emerald-400/10 text-emerald-400 rounded-full px-1.5 py-px">
                    <CheckCircle2 size={8} className="inline -mt-px" />
                  </span>
                )}
                {tab.id === 'documents' && docsFormData && (
                  <span className="ml-1 text-[10px] bg-emerald-400/10 text-emerald-400 rounded-full px-1.5 py-px">
                    <CheckCircle2 size={8} className="inline -mt-px" />
                  </span>
                )}
                {tab.id === 'liens' && [project.figmaUrl, project.contentUrl, project.client.website].filter(Boolean).length > 0 && (
                  <span className="ml-1 text-[10px] bg-slate-800 text-slate-400 rounded-full px-1.5 py-px">
                    {[project.figmaUrl, project.contentUrl, project.client.website].filter(Boolean).length}
                  </span>
                )}
                {tab.id === 'equipe' && project.assignments.length > 0 && (
                  <span className="ml-1 text-[10px] bg-slate-800 text-slate-400 rounded-full px-1.5 py-px">
                    {project.assignments.length}
                  </span>
                )}
                {tab.id === 'factures' && invoices.length > 0 && (
                  <span className="ml-1 text-[10px] bg-[#E14B89]/20 text-[#E14B89] rounded-full px-1.5 py-px">
                    {invoices.length}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* ── Freelancer acceptance banner ────────────────────────────────── */}
      {myAssignment && myAssignment.status === 'EN_ATTENTE' && !isAdmin && (
        <div className="mx-6 lg:mx-10 mt-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-2xl p-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={20} className="text-amber-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-semibold text-sm mb-1">Nouvelle mission en attente</h3>
              <p className="text-slate-400 text-xs mb-3">Vous avez été assigné à ce projet. Veuillez accepter ou proposer des modifications.</p>
              <div className="flex items-center gap-3 text-sm mb-4">
                {myAssignment.price != null && userRole !== 'DESIGNER' && (
                  <span className="text-white"><span className="text-slate-500">Prix :</span> {formatCurrency(myAssignment.price)}</span>
                )}
                <span className="text-white"><span className="text-slate-500">Deadline :</span> {myAssignment.deadline ? formatDate(myAssignment.deadline) : 'Non définie'}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleRespondMission('accept')} className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-medium transition-colors">Accepter</button>
                <button onClick={() => handleRespondMission('counter')} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-medium transition-colors">Contre-proposition</button>
                <button onClick={() => handleRespondMission('refuse')} className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-2 rounded-xl text-xs font-medium transition-colors">Refuser</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab content ────────────────────────────────────────────────────── */}
      <div className="flex-1 px-6 lg:px-10 py-6">

        {/* ════════════════════════════════════════════════════════════════════
            AVANCEMENT
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'avancement' && (
          <div className="space-y-6">

            {/* ── Edit form (shown when editing) ──────────────────────────── */}
            {editing && (
              <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
                <h2 className="text-white font-semibold mb-4">Modifier les détails</h2>
                <div className="space-y-3 max-w-lg">
                  {isAdmin && (
                    <div>
                      <label className="block text-slate-400 text-xs mb-1">Prix (€)</label>
                      <input
                        type="number"
                        value={(form.price as unknown as string) ?? ''}
                        onChange={e => setForm({ ...form, price: e.target.value as unknown as undefined })}
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-slate-400 text-xs mb-1">Deadline</label>
                    <input
                      type="date"
                      value={form.deadline as string ?? ''}
                      onChange={e => setForm({ ...form, deadline: e.target.value })}
                      className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-xs mb-1">Mois de signature</label>
                    <input
                      type="month"
                      value={(form as Record<string, unknown>).signedAt as string ?? ''}
                      onChange={e => setForm({ ...form, signedAt: e.target.value } as typeof form)}
                      className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-xs mb-1">Notes</label>
                    <textarea
                      value={form.notes ?? ''}
                      rows={4}
                      onChange={e => setForm({ ...form, notes: e.target.value })}
                      className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── Pipeline stepper ────────────────────────────────────────── */}
            {(() => {
              const nonAdminAssignments = project.assignments.filter(a => a.user.role !== 'ADMIN')
              const accepted = nonAdminAssignments.filter(a => a.status === 'VALIDE')
              const allAccepted = nonAdminAssignments.length === 0 || nonAdminAssignments.every(a => a.status === 'VALIDE')
              const briefReceived = formStatus?.briefCompleted ?? false
              const designReceived = formStatus?.designCompleted ?? false
              const accesReceived = formStatus?.accesCompleted ?? false
              const docsReceived = formStatus?.docsCompleted ?? project.clientForm?.docsCompleted ?? false
              const allFormsComplete = briefReceived && designReceived && accesReceived && docsReceived
              const formBypassed = !!project.formBypassedAt
              const projectUnlocked = allAccepted && (allFormsComplete || formBypassed)

              if (!projectUnlocked) {
                return (
                  <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                        <Lock size={18} className="text-amber-400" />
                      </div>
                      <div>
                        <h2 className="text-white font-semibold">Projet verrouillé</h2>
                        <p className="text-slate-500 text-xs mt-0.5">
                          Le suivi d&apos;avancement sera disponible une fois toutes les conditions remplies.
                        </p>
                      </div>
                    </div>

                    {/* Checklist conditions */}
                    <div className="space-y-2 mb-4">
                      <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg ${allAccepted ? 'bg-emerald-500/10' : 'bg-slate-800/50'}`}>
                        {allAccepted ? <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" /> : <Clock size={14} className="text-amber-400 flex-shrink-0" />}
                        <span className={`text-xs ${allAccepted ? 'text-emerald-400' : 'text-slate-400'}`}>
                          Freelancers validés ({accepted.length}/{nonAdminAssignments.length})
                        </span>
                      </div>
                      <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg ${allFormsComplete ? 'bg-emerald-500/10' : 'bg-slate-800/50'}`}>
                        {allFormsComplete ? <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" /> : <Clock size={14} className="text-amber-400 flex-shrink-0" />}
                        <span className={`text-xs ${allFormsComplete ? 'text-emerald-400' : 'text-slate-400'}`}>Formulaire client</span>
                        <div className="flex items-center gap-1.5 ml-auto">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${briefReceived ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700/50 text-slate-500'}`}>Brief</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${designReceived ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700/50 text-slate-500'}`}>Design</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${accesReceived ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700/50 text-slate-500'}`}>Accès</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${docsReceived ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700/50 text-slate-500'}`}>Documents</span>
                        </div>
                      </div>
                    </div>

                    {/* Détail freelancers si pas tous acceptés */}
                    {!allAccepted && project.assignments.length > 0 && (
                      <div className="space-y-2 pt-3 border-t border-slate-800">
                        {[...project.assignments].sort((a, b) => (ROLE_PRIORITY[a.user.role] ?? 99) - (ROLE_PRIORITY[b.user.role] ?? 99)).map(a => {
                          const statusColor = MISSION_STATUS_COLORS[a.status] || 'bg-slate-500/20 text-slate-400 border-slate-600'
                          const statusLabel = MISSION_STATUS_LABELS[a.status] || a.status
                          const roleColor = ROLE_AVATAR_COLORS[a.user.role] || 'bg-slate-700'
                          return (
                            <div key={a.id} className="flex items-center gap-3 bg-[#0d0d14] rounded-xl px-4 py-3">
                              <div className={`w-8 h-8 rounded-full ${roleColor} flex items-center justify-center flex-shrink-0`}>
                                <span className="text-white text-xs font-semibold">
                                  {a.user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-white text-sm font-medium truncate">{a.user.name}</span>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${statusColor}`}>
                                    {statusLabel}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 mt-0.5">
                                  {a.price != null && (
                                    <span className="text-slate-500 text-xs flex items-center gap-1">
                                      <DollarSign size={10} />{formatCurrency(a.price)}
                                    </span>
                                  )}
                                  {a.delayDays != null && (
                                    <span className="text-slate-500 text-xs flex items-center gap-1">
                                      <Clock size={10} />{a.delayDays} jours
                                    </span>
                                  )}
                                  {a.deadline && (
                                    <span className="text-slate-500 text-xs flex items-center gap-1">
                                      <Clock size={10} />Deadline : {formatDate(a.deadline)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {a.status === 'CONTRE_PROPOSITION' && (
                                <div className="text-right flex-shrink-0">
                                  {a.counterPrice != null && (
                                    <p className="text-orange-400 text-xs font-medium">{formatCurrency(a.counterPrice)}</p>
                                  )}
                                  {a.counterDeadline && (
                                    <p className="text-orange-400/70 text-[10px]">{formatDate(a.counterDeadline)}</p>
                                  )}
                                  {a.counterNote && (
                                    <p className="text-slate-500 text-[10px] max-w-[150px] truncate mt-0.5" title={a.counterNote}>
                                      &quot;{a.counterNote}&quot;
                                    </p>
                                  )}
                                </div>
                              )}
                              <div className="flex-shrink-0">
                                {a.status === 'VALIDE' && <CheckCircle2 size={16} className="text-green-400" />}
                                {a.status === 'EN_ATTENTE' && <Clock size={16} className="text-amber-400" />}
                                {a.status === 'CONTRE_PROPOSITION' && <MessageSquare size={16} className="text-orange-400" />}
                                {a.status === 'REFUSE' && <X size={16} className="text-red-400" />}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Bypass formulaire client — ADMIN only */}
                    {isAdmin && !allFormsComplete && (
                      <div className="pt-3 border-t border-slate-800">
                        <button
                          onClick={async () => {
                            if (!confirm('Débloquer le projet sans formulaire client ?')) return
                            await fetch(`/api/projects/${id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ formBypassedAt: new Date().toISOString() }),
                            })
                            location.reload()
                          }}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-medium transition-colors"
                        >
                          <Unlock size={14} />
                          Débloquer sans formulaire client
                        </button>
                      </div>
                    )}
                  </div>
                )
              }

              // ── Projet débloqué : pipeline avec deadlines par étape ──
              const prestation = project.services?.[0] || ''
              const pipelineStages = PIPELINE_BY_PRESTATION[prestation] || ['REDACTION', 'MAQUETTE', 'DEVELOPPEMENT', 'LIVRAISON']
              const roleToStage = ROLE_TO_STAGE_BY_PRESTATION[prestation] || {}
              const stageDeadlines: Record<string, string> = {}
              project.assignments.forEach(a => {
                const stage = roleToStage[a.user.role]
                if (stage && a.deadline) stageDeadlines[stage] = a.deadline
              })

              return (
                <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
                  <h2 className="text-white font-semibold mb-6">Suivi de l&apos;avancement</h2>
                  <div className="relative">
                    <div className="absolute top-5 left-5 right-5 h-px bg-slate-800 z-0" />
                    <div className="flex justify-between relative z-10">
                      {pipelineStages.map((s, i) => {
                        const currentIdx = pipelineStages.indexOf(project.status)
                        const sIdx       = i
                        const isActive   = s === project.status
                        const isDone     = currentIdx >= 0 ? sIdx < currentIdx : false
                        const deadline   = stageDeadlines[s]
                        return (
                          <button
                            key={s}
                            onClick={() => handleStatusClick(s)}
                            className="flex flex-col items-center gap-1.5 group"
                          >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all border-2 ${
                              isActive
                                ? 'bg-gradient-to-br from-[#E14B89] to-[#F8903C] border-transparent shadow-lg shadow-[#E14B89]/30'
                                : isDone
                                ? 'bg-[#E14B89]/15 border-[#E14B89]/40'
                                : 'bg-slate-800 border-slate-700 group-hover:border-slate-500'
                            }`}>
                              {isDone
                                ? <CheckCircle2 size={16} className="text-[#E14B89]" />
                                : <span className={`text-xs font-semibold ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`}>{i + 1}</span>
                              }
                            </div>
                            <span className={`text-[10px] font-medium text-center leading-tight ${
                              isActive ? 'text-white' : isDone ? 'text-[#E14B89]/70' : 'text-slate-600 group-hover:text-slate-400'
                            }`}>
                              {PROJECT_STATUS_LABELS[s]}
                            </span>
                            {deadline && (
                              <span className={`text-[9px] ${isDone ? 'text-[#E14B89]/50' : isActive ? 'text-slate-400' : 'text-slate-600'}`}>
                                {formatDate(deadline)}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            BRIEF
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'brief' && (
          <div className="max-w-2xl space-y-5">
            {/* Brief data from client form */}
            {briefFormData ? (
              <>
                {/* Offre */}
                {(briefFormData.offreResume || briefFormData.offreDetail || briefFormData.fourchettePrix || briefFormData.differenciation || briefFormData.usp) && (
                  <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Megaphone size={16} className="text-blue-400" />
                      <h2 className="text-white font-medium">Offre</h2>
                    </div>
                    <div className="space-y-3">
                      {briefFormData.offreResume && (
                        <div className="flex gap-3">
                          <span className="text-slate-500 text-xs w-36 flex-shrink-0 pt-0.5">Résumé</span>
                          <span className="text-slate-300 text-sm whitespace-pre-wrap">{briefFormData.offreResume}</span>
                        </div>
                      )}
                      {briefFormData.offreDetail && (
                        <div className="flex gap-3">
                          <span className="text-slate-500 text-xs w-36 flex-shrink-0 pt-0.5">Détail</span>
                          <span className="text-slate-300 text-sm whitespace-pre-wrap">{briefFormData.offreDetail}</span>
                        </div>
                      )}
                      {briefFormData.fourchettePrix && (
                        <div className="flex gap-3">
                          <span className="text-slate-500 text-xs w-36 flex-shrink-0 pt-0.5">Fourchette de prix</span>
                          <span className="text-slate-300 text-sm whitespace-pre-wrap">{briefFormData.fourchettePrix}</span>
                        </div>
                      )}
                      {briefFormData.differenciation && (
                        <div className="flex gap-3">
                          <span className="text-slate-500 text-xs w-36 flex-shrink-0 pt-0.5">Différenciation</span>
                          <span className="text-slate-300 text-sm whitespace-pre-wrap">{briefFormData.differenciation}</span>
                        </div>
                      )}
                      {briefFormData.usp && (
                        <div className="flex gap-3">
                          <span className="text-slate-500 text-xs w-36 flex-shrink-0 pt-0.5">USP</span>
                          <span className="text-slate-300 text-sm whitespace-pre-wrap">{briefFormData.usp}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Persona */}
                {(briefFormData.personaTypes || briefFormData.personaPeurs || briefFormData.parcoursAchat) && (
                  <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Users2 size={16} className="text-violet-400" />
                      <h2 className="text-white font-medium">Persona</h2>
                    </div>
                    <div className="space-y-3">
                      {briefFormData.personaTypes && (
                        <div className="flex gap-3">
                          <span className="text-slate-500 text-xs w-36 flex-shrink-0 pt-0.5">Types de clients</span>
                          <span className="text-slate-300 text-sm whitespace-pre-wrap">{briefFormData.personaTypes}</span>
                        </div>
                      )}
                      {briefFormData.personaPeurs && (
                        <div className="flex gap-3">
                          <span className="text-slate-500 text-xs w-36 flex-shrink-0 pt-0.5">Peurs / Freins</span>
                          <span className="text-slate-300 text-sm whitespace-pre-wrap">{briefFormData.personaPeurs}</span>
                        </div>
                      )}
                      {briefFormData.parcoursAchat && (
                        <div className="flex gap-3">
                          <span className="text-slate-500 text-xs w-36 flex-shrink-0 pt-0.5">Parcours d&apos;achat</span>
                          <span className="text-slate-300 text-sm whitespace-pre-wrap">{briefFormData.parcoursAchat}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Branding & ton */}
                {(briefFormData.toneOfVoice || briefFormData.valeurs || briefFormData.sujetsInterdits || briefFormData.termesInterdits || briefFormData.documentationInterne) && (
                  <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Paintbrush size={16} className="text-amber-400" />
                      <h2 className="text-white font-medium">Branding & ton</h2>
                    </div>
                    <div className="space-y-3">
                      {briefFormData.toneOfVoice && (
                        <div className="flex gap-3">
                          <span className="text-slate-500 text-xs w-36 flex-shrink-0 pt-0.5">Ton de voix</span>
                          <span className="text-slate-300 text-sm whitespace-pre-wrap">{briefFormData.toneOfVoice}</span>
                        </div>
                      )}
                      {briefFormData.valeurs && (
                        <div className="flex gap-3">
                          <span className="text-slate-500 text-xs w-36 flex-shrink-0 pt-0.5">Valeurs</span>
                          <span className="text-slate-300 text-sm whitespace-pre-wrap">{briefFormData.valeurs}</span>
                        </div>
                      )}
                      {briefFormData.sujetsInterdits && (
                        <div className="flex gap-3">
                          <span className="text-slate-500 text-xs w-36 flex-shrink-0 pt-0.5">Sujets interdits</span>
                          <span className="text-slate-300 text-sm whitespace-pre-wrap">{briefFormData.sujetsInterdits}</span>
                        </div>
                      )}
                      {briefFormData.termesInterdits && (
                        <div className="flex gap-3">
                          <span className="text-slate-500 text-xs w-36 flex-shrink-0 pt-0.5">Termes interdits</span>
                          <span className="text-slate-300 text-sm whitespace-pre-wrap">{briefFormData.termesInterdits}</span>
                        </div>
                      )}
                      {briefFormData.documentationInterne && (
                        <div className="flex gap-3">
                          <span className="text-slate-500 text-xs w-36 flex-shrink-0 pt-0.5">Documentation</span>
                          <span className="text-slate-300 text-sm whitespace-pre-wrap">{briefFormData.documentationInterne}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Contact */}
                {(briefFormData.contactEmail || briefFormData.contactPhone) && (
                  <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Mail size={16} className="text-emerald-400" />
                      <h2 className="text-white font-medium">Contact</h2>
                    </div>
                    <div className="space-y-3">
                      {briefFormData.contactEmail && (
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500 text-xs w-36 flex-shrink-0">Email</span>
                          <span className="text-white text-sm">{briefFormData.contactEmail}</span>
                        </div>
                      )}
                      {briefFormData.contactPhone && (
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500 text-xs w-36 flex-shrink-0">Téléphone</span>
                          <span className="text-white text-sm">{briefFormData.contactPhone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-[#111118] border border-dashed border-slate-700 rounded-2xl p-10 text-center opacity-60">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                  <Clock size={20} className="text-amber-500/60" />
                </div>
                <p className="text-slate-400 text-sm font-medium">En attente du formulaire client</p>
                <p className="text-slate-600 text-xs mt-1.5">L&apos;étape Brief n&apos;a pas encore été remplie par le client</p>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            CDC (Mission)
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'cdc' && (() => {
          const cdcDocs = project.documents.filter(d => d.category === 'CAHIER_DES_CHARGES')
          return (
            <div className="max-w-2xl space-y-5">
              {/* CDC form data */}
              {cdcFormData && (
                <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <ClipboardList size={16} className="text-violet-400" />
                    <h2 className="text-white font-medium">Informations mission</h2>
                    <span className="text-emerald-400 text-[10px] font-medium bg-emerald-400/10 px-2 py-0.5 rounded-full">Rempli</span>
                    {!editingCdc ? (
                      <button onClick={() => { setCdcDraft({ ...cdcFormData }); setEditingCdc(true) }} className="ml-auto flex items-center gap-1.5 text-slate-400 hover:text-white text-xs transition-colors">
                        <Pencil size={12} /> Modifier
                      </button>
                    ) : (
                      <div className="ml-auto flex items-center gap-2">
                        <button onClick={() => setEditingCdc(false)} className="text-slate-400 hover:text-white text-xs transition-colors">Annuler</button>
                        <button onClick={saveCdcData} disabled={savingCdc} className="flex items-center gap-1.5 bg-[#E14B89] hover:opacity-90 text-white text-xs px-3 py-1.5 rounded-lg transition-opacity disabled:opacity-60">
                          {savingCdc ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Enregistrer
                        </button>
                      </div>
                    )}
                  </div>
                  {editingCdc && cdcDraft ? (
                    <div className="space-y-4">
                      {project.services?.[0] === 'Branding' ? (
                        <>
                          <div>
                            <label className="block text-slate-400 text-xs mb-1.5">Style souhaité</label>
                            <textarea value={cdcDraft.styleSouhaite || ''} onChange={e => setCdcDraft(d => d ? { ...d, styleSouhaite: e.target.value } : d)} rows={2} className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none" />
                          </div>
                          <div>
                            <label className="block text-slate-400 text-xs mb-1.5">Exemples / Marques</label>
                            <textarea value={cdcDraft.exemplesMarques || ''} onChange={e => setCdcDraft(d => d ? { ...d, exemplesMarques: e.target.value } : d)} rows={2} className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none" />
                          </div>
                          <div>
                            <label className="block text-slate-400 text-xs mb-1.5">Couleurs</label>
                            <input value={cdcDraft.couleurs || ''} onChange={e => setCdcDraft(d => d ? { ...d, couleurs: e.target.value } : d)} className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                          </div>
                          <div>
                            <label className="block text-slate-400 text-xs mb-1.5">Ambiance</label>
                            <input value={cdcDraft.ambiance || ''} onChange={e => setCdcDraft(d => d ? { ...d, ambiance: e.target.value } : d)} className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                          </div>
                          <div>
                            <label className="block text-slate-400 text-xs mb-1.5">Autres infos</label>
                            <textarea value={cdcDraft.autresInfos || ''} onChange={e => setCdcDraft(d => d ? { ...d, autresInfos: e.target.value } : d)} rows={2} className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none" />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-slate-400 text-xs mb-1.5">Type de site</label>
                              <select value={cdcDraft.siteType || 'VITRINE'} onChange={e => setCdcDraft(d => d ? { ...d, siteType: e.target.value } : d)} className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                                <option value="VITRINE">Site vitrine</option>
                                <option value="ECOMMERCE">E-commerce</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-slate-400 text-xs mb-1.5">Refonte</label>
                              <select value={cdcDraft.isRefonte ? 'true' : 'false'} onChange={e => setCdcDraft(d => d ? { ...d, isRefonte: e.target.value === 'true' } : d)} className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                                <option value="false">Non</option>
                                <option value="true">Oui</option>
                              </select>
                            </div>
                          </div>
                          {cdcDraft.isRefonte && (
                            <div>
                              <label className="block text-slate-400 text-xs mb-1.5">Site internet actuel</label>
                              <input value={cdcDraft.siteActuel || ''} onChange={e => setCdcDraft(d => d ? { ...d, siteActuel: e.target.value } : d)}
                                placeholder="https://www.exemple.fr"
                                className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                            </div>
                          )}
                          <div>
                            <label className="block text-slate-400 text-xs mb-1.5">Arborescence</label>
                            <textarea value={cdcDraft.arborescence || ''} onChange={e => setCdcDraft(d => d ? { ...d, arborescence: e.target.value } : d)} rows={3} className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none" />
                          </div>
                          <div>
                            <label className="block text-slate-400 text-xs mb-1.5">Espace client</label>
                            <select value={cdcDraft.espaceClient ? 'true' : 'false'} onChange={e => setCdcDraft(d => d ? { ...d, espaceClient: e.target.value === 'true' } : d)} className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                              <option value="false">Non</option>
                              <option value="true">Oui</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-slate-400 text-xs mb-1.5">Fonctionnalités</label>
                            <div className="flex flex-wrap gap-2">
                              {CDC_FONCTIONNALITES.map(f => (
                                <button key={f} type="button" onClick={() => setCdcDraft(d => {
                                  if (!d) return d
                                  const fns = d.fonctionnalites || []
                                  return { ...d, fonctionnalites: fns.includes(f) ? fns.filter(x => x !== f) : [...fns, f] }
                                })} className={`text-xs px-2.5 py-1 rounded-full transition-all ${cdcDraft.fonctionnalites?.includes(f) ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'}`}>
                                  {f}
                                </button>
                              ))}
                            </div>
                          </div>
                          {cdcDraft.fonctionnalites?.includes('Formulaire') && (
                            <div>
                              <label className="block text-slate-400 text-xs mb-1.5">Champs du formulaire</label>
                              <textarea value={cdcDraft.formulaireChamps || ''} onChange={e => setCdcDraft(d => d ? { ...d, formulaireChamps: e.target.value } : d)} rows={3}
                                placeholder="Ex : Nom, Prénom, Email, Téléphone, Message, Budget..."
                                className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none" />
                            </div>
                          )}
                          <div>
                            <label className="block text-slate-400 text-xs mb-1.5">Autres infos</label>
                            <textarea value={cdcDraft.autresInfos || ''} onChange={e => setCdcDraft(d => d ? { ...d, autresInfos: e.target.value } : d)} rows={2} className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none" />
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                  <div className="space-y-3">
                    {project.services?.[0] === 'Branding' ? (
                      <>
                        {cdcFormData.styleSouhaite && (
                          <div className="flex gap-3">
                            <span className="text-slate-500 text-xs w-32 flex-shrink-0 pt-0.5">Style souhaité</span>
                            <span className="text-slate-300 text-sm whitespace-pre-wrap">{cdcFormData.styleSouhaite}</span>
                          </div>
                        )}
                        {cdcFormData.exemplesMarques && (
                          <div className="flex gap-3">
                            <span className="text-slate-500 text-xs w-32 flex-shrink-0 pt-0.5">Exemples</span>
                            <span className="text-slate-300 text-sm whitespace-pre-wrap">{cdcFormData.exemplesMarques}</span>
                          </div>
                        )}
                        {cdcFormData.couleurs && (
                          <div className="flex gap-3">
                            <span className="text-slate-500 text-xs w-32 flex-shrink-0 pt-0.5">Couleurs</span>
                            <span className="text-slate-300 text-sm whitespace-pre-wrap">{cdcFormData.couleurs}</span>
                          </div>
                        )}
                        {cdcFormData.ambiance && (
                          <div className="flex gap-3">
                            <span className="text-slate-500 text-xs w-32 flex-shrink-0 pt-0.5">Ambiance</span>
                            <span className="text-slate-300 text-sm whitespace-pre-wrap">{cdcFormData.ambiance}</span>
                          </div>
                        )}
                        {cdcFormData.autresInfos && (
                          <div className="flex gap-3">
                            <span className="text-slate-500 text-xs w-32 flex-shrink-0 pt-0.5">Autres infos</span>
                            <span className="text-slate-300 text-sm whitespace-pre-wrap">{cdcFormData.autresInfos}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500 text-xs w-32 flex-shrink-0">Type de site</span>
                          <span className="text-white text-sm">{cdcFormData.siteType === 'ECOMMERCE' ? 'E-commerce' : 'Site vitrine'}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500 text-xs w-32 flex-shrink-0">Refonte</span>
                          <span className="text-white text-sm">{cdcFormData.isRefonte ? 'Oui' : 'Non'}</span>
                        </div>
                        {cdcFormData.isRefonte && cdcFormData.siteActuel && (
                          <div className="flex items-center gap-3">
                            <span className="text-slate-500 text-xs w-32 flex-shrink-0">Site actuel</span>
                            <a href={cdcFormData.siteActuel.startsWith('http') ? cdcFormData.siteActuel : `https://${cdcFormData.siteActuel}`}
                              target="_blank" rel="noopener noreferrer" className="text-[#E14B89] text-sm hover:underline">{cdcFormData.siteActuel}</a>
                          </div>
                        )}
                        {cdcFormData.arborescence && (
                          <div className="flex gap-3">
                            <span className="text-slate-500 text-xs w-32 flex-shrink-0 pt-0.5">Arborescence</span>
                            <span className="text-slate-300 text-sm whitespace-pre-wrap">{cdcFormData.arborescence}</span>
                          </div>
                        )}
                        {cdcFormData.espaceClient !== undefined && (
                          <div className="flex items-center gap-3">
                            <span className="text-slate-500 text-xs w-32 flex-shrink-0">Espace client</span>
                            <span className="text-white text-sm">{cdcFormData.espaceClient ? 'Oui' : 'Non'}</span>
                          </div>
                        )}
                        {cdcFormData.fonctionnalites && cdcFormData.fonctionnalites.length > 0 && (
                          <div className="flex gap-3">
                            <span className="text-slate-500 text-xs w-32 flex-shrink-0 pt-0.5">Fonctionnalités</span>
                            <div className="flex flex-wrap gap-1.5">
                              {cdcFormData.fonctionnalites.map(f => (
                                <span key={f} className="text-xs bg-violet-500/10 text-violet-300 px-2 py-0.5 rounded-full">{f}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {cdcFormData.fonctionnalites?.includes('Formulaire') && cdcFormData.formulaireChamps && (
                          <div className="flex gap-3">
                            <span className="text-slate-500 text-xs w-32 flex-shrink-0 pt-0.5">Champs formulaire</span>
                            <span className="text-slate-300 text-sm whitespace-pre-wrap">{cdcFormData.formulaireChamps}</span>
                          </div>
                        )}
                        {cdcFormData.catalogueInfo && (
                          <div className="flex gap-3">
                            <span className="text-slate-500 text-xs w-32 flex-shrink-0 pt-0.5">Catalogue</span>
                            <span className="text-slate-300 text-sm whitespace-pre-wrap">{cdcFormData.catalogueInfo}</span>
                          </div>
                        )}
                        {cdcFormData.livraisonInfo && (
                          <div className="flex gap-3">
                            <span className="text-slate-500 text-xs w-32 flex-shrink-0 pt-0.5">Livraison</span>
                            <span className="text-slate-300 text-sm whitespace-pre-wrap">{cdcFormData.livraisonInfo}</span>
                          </div>
                        )}
                        {cdcFormData.paiementInfo && (
                          <div className="flex gap-3">
                            <span className="text-slate-500 text-xs w-32 flex-shrink-0 pt-0.5">Paiement</span>
                            <span className="text-slate-300 text-sm whitespace-pre-wrap">{cdcFormData.paiementInfo}</span>
                          </div>
                        )}
                        {cdcFormData.autresInfos && (
                          <div className="flex gap-3">
                            <span className="text-slate-500 text-xs w-32 flex-shrink-0 pt-0.5">Autres infos</span>
                            <span className="text-slate-300 text-sm whitespace-pre-wrap">{cdcFormData.autresInfos}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  )}
                </div>
              )}

            </div>
          )
        })()}

        {/* ════════════════════════════════════════════════════════════════════
            DESIGN
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'design' && (
          <div className="max-w-2xl space-y-5">
            {designFormData ? (
              <>
                {/* Préférences générales */}
                <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Paintbrush size={16} className="text-pink-400" />
                    <h2 className="text-white font-medium">Préférences générales</h2>
                    <span className="ml-auto text-emerald-400 text-[10px] font-medium bg-emerald-400/10 px-2 py-0.5 rounded-full">Rempli</span>
                  </div>
                  <div className="space-y-3">
                    {designFormData.fond && (
                      <div className="flex items-center gap-3">
                        <span className="text-slate-500 text-xs w-32 flex-shrink-0">Fond du site</span>
                        <span className="text-white text-sm capitalize">{designFormData.fond}</span>
                      </div>
                    )}
                    {designFormData.formes && (
                      <div className="flex items-center gap-3">
                        <span className="text-slate-500 text-xs w-32 flex-shrink-0">Style des formes</span>
                        <span className="text-white text-sm capitalize">{designFormData.formes}</span>
                      </div>
                    )}
                    {designFormData.stylesSouhaites && designFormData.stylesSouhaites.length > 0 && (
                      <div className="flex gap-3">
                        <span className="text-slate-500 text-xs w-32 flex-shrink-0 pt-0.5">Styles visuels</span>
                        <div className="flex flex-wrap gap-1.5">
                          {designFormData.stylesSouhaites.map(s => (
                            <span key={s} className="text-xs bg-pink-500/10 text-pink-300 px-2 py-0.5 rounded-full">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {designFormData.styleSouhaite && !designFormData.stylesSouhaites?.length && (
                      <div className="flex gap-3">
                        <span className="text-slate-500 text-xs w-32 flex-shrink-0 pt-0.5">Style souhaité</span>
                        <span className="text-slate-300 text-sm whitespace-pre-wrap">{designFormData.styleSouhaite}</span>
                      </div>
                    )}
                    {designFormData.sitesExemple && (
                      <div className="flex gap-3">
                        <span className="text-slate-500 text-xs w-32 flex-shrink-0 pt-0.5">Sites d&apos;exemple</span>
                        <span className="text-slate-300 text-sm whitespace-pre-wrap">{designFormData.sitesExemple}</span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-[#111118] border border-dashed border-slate-700 rounded-2xl p-10 text-center opacity-60">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                  <Clock size={20} className="text-amber-500/60" />
                </div>
                <p className="text-slate-400 text-sm font-medium">En attente du formulaire client</p>
                <p className="text-slate-600 text-xs mt-1.5">L&apos;étape Design n&apos;a pas encore été remplie par le client</p>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            ACCÈS
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'acces' && (
          <div className="max-w-2xl space-y-5">
            {accesFormData ? (
              <>
                {/* Email pro */}
                {(accesFormData.emailPro || accesFormData.emailProMdp) && (
                  <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Mail size={16} className="text-blue-400" />
                      <h2 className="text-white font-medium">Email professionnel</h2>
                    </div>
                    <div className="space-y-3">
                      {accesFormData.emailPro && (
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500 text-xs w-32 flex-shrink-0">Email</span>
                          <span className="text-white text-sm">{accesFormData.emailPro}</span>
                        </div>
                      )}
                      {accesFormData.emailProMdp && (
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500 text-xs w-32 flex-shrink-0">Mot de passe</span>
                          <span className="text-white text-sm font-mono bg-[#1a1a24] px-2 py-0.5 rounded">{accesFormData.emailProMdp}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Réseaux sociaux */}
                {(accesFormData.facebook || accesFormData.instagram || accesFormData.linkedin) && (
                  <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Globe size={16} className="text-violet-400" />
                      <h2 className="text-white font-medium">Réseaux sociaux</h2>
                    </div>
                    <div className="space-y-3">
                      {accesFormData.facebook && (
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500 text-xs w-32 flex-shrink-0">Facebook</span>
                          <a href={accesFormData.facebook} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-sm hover:underline truncate">{accesFormData.facebook}</a>
                        </div>
                      )}
                      {accesFormData.instagram && (
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500 text-xs w-32 flex-shrink-0">Instagram</span>
                          <a href={accesFormData.instagram} target="_blank" rel="noopener noreferrer" className="text-pink-400 text-sm hover:underline truncate">{accesFormData.instagram}</a>
                        </div>
                      )}
                      {accesFormData.linkedin && (
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500 text-xs w-32 flex-shrink-0">LinkedIn</span>
                          <a href={accesFormData.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-300 text-sm hover:underline truncate">{accesFormData.linkedin}</a>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Calendly & Stripe */}
                {(accesFormData.calendlyAcces || accesFormData.stripeAcces) && (
                  <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <KeyRound size={16} className="text-amber-400" />
                      <h2 className="text-white font-medium">Intégrations</h2>
                    </div>
                    <div className="space-y-3">
                      {accesFormData.calendlyAcces && (
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500 text-xs w-32 flex-shrink-0">Calendly</span>
                          <a href={accesFormData.calendlyAcces} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-sm hover:underline truncate">{accesFormData.calendlyAcces}</a>
                        </div>
                      )}
                      {accesFormData.stripeAcces && (
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500 text-xs w-32 flex-shrink-0">Stripe</span>
                          <span className="text-white text-sm font-mono bg-[#1a1a24] px-2 py-0.5 rounded truncate">{accesFormData.stripeAcces}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Autres accès */}
                {accesFormData.autresAcces && (
                  <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Info size={16} className="text-slate-400" />
                      <h2 className="text-white font-medium">Autres accès</h2>
                    </div>
                    <p className="text-slate-300 text-sm whitespace-pre-wrap">{accesFormData.autresAcces}</p>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-[#111118] border border-dashed border-slate-700 rounded-2xl p-10 text-center opacity-60">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                  <Clock size={20} className="text-amber-500/60" />
                </div>
                <p className="text-slate-400 text-sm font-medium">En attente du formulaire client</p>
                <p className="text-slate-600 text-xs mt-1.5">L&apos;étape Accès n&apos;a pas encore été remplie par le client</p>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            DOCUMENTS
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'documents' && (() => {
          const FORM_TO_DOC_CAT: Record<string, string> = {
            identite_visuelle: 'CHARTE_GRAPHIQUE',
            documents_legaux: 'DOCUMENT_LEGAL',
            contenu_client: 'CONTENU_CLIENT',
            autres: 'AUTRE',
          }
          const formFilesByCat: Record<string, { name: string; url: string; size: number }[]> = {}
          if (docsFormData?.categories) {
            Object.entries(docsFormData.categories).forEach(([formKey, files]) => {
              const docCat = FORM_TO_DOC_CAT[formKey] || 'AUTRE'
              if (!formFilesByCat[docCat]) formFilesByCat[docCat] = []
              ;(files || []).forEach(f => formFilesByCat[docCat].push({ name: f.filename || f.name, url: f.url, size: f.size }))
            })
          }
          const hasAnyDoc = project.documents.length > 0 || Object.values(formFilesByCat).some(f => f.length > 0)
          if (!hasAnyDoc) return (
            <div className="max-w-2xl">
              <div className="bg-[#111118] border border-dashed border-slate-700 rounded-2xl p-10 text-center opacity-60">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                  <Clock size={20} className="text-amber-500/60" />
                </div>
                <p className="text-slate-400 text-sm font-medium">En attente du formulaire client</p>
                <p className="text-slate-600 text-xs mt-1.5">L&apos;étape Documents n&apos;a pas encore été remplie par le client</p>
              </div>
              <button
                onClick={() => setShowDocModal(true)}
                className="mt-4 flex items-center gap-1.5 text-[#E14B89] hover:text-[#F8903C] text-sm transition-colors mx-auto"
              >
                <Plus size={15} /> Ajouter un document manuellement
              </button>
            </div>
          )
          return (
          <div className="max-w-2xl">
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Upload size={16} className="text-slate-400" />
                  <h2 className="text-white font-medium">Documents</h2>
                </div>
                <button
                  onClick={() => setShowDocModal(true)}
                  className="flex items-center gap-1.5 text-[#E14B89] hover:text-[#F8903C] text-sm transition-colors"
                >
                  <Plus size={15} /> Ajouter
                </button>
              </div>
              <div className="space-y-1">
                {DOC_CATEGORIES.map(cat => {
                  const manualDocs = project.documents.filter(d => d.category === cat.key)
                  const clientFiles = formFilesByCat[cat.key] || []
                  const totalCount = manualDocs.length + clientFiles.length
                  const isExpanded = expandedCats[cat.key] !== false
                  const CatIcon    = cat.icon
                  return (
                    <div key={cat.key}>
                      <button
                        onClick={() => toggleCat(cat.key)}
                        className="w-full flex items-center gap-2.5 py-2 px-1 rounded-lg hover:bg-slate-800/40 transition-colors group"
                      >
                        <CatIcon size={14} className={cat.color} />
                        <span className="flex-1 text-left text-sm text-slate-300 group-hover:text-white transition-colors">
                          {cat.label}
                        </span>
                        <span className="text-slate-600 text-xs mr-1">{totalCount}</span>
                        {isExpanded
                          ? <ChevronDown size={13} className="text-slate-600" />
                          : <ChevronRight size={13} className="text-slate-600" />
                        }
                      </button>
                      {isExpanded && (
                        <div className="ml-6 mb-1 space-y-1">
                          {totalCount === 0 ? (
                            <p className="text-slate-600 text-xs py-1 italic">Aucun document</p>
                          ) : (
                            <>
                              {clientFiles.map((file, i) => (
                                <div key={`form-${i}`} className="flex items-center gap-2 group py-1">
                                  <Link2 size={12} className="text-slate-600 flex-shrink-0" />
                                  <a
                                    href={file.url}
                                    target="_blank" rel="noopener noreferrer"
                                    className="flex-1 text-sm text-slate-300 hover:text-white truncate transition-colors"
                                  >
                                    {file.name}
                                  </a>
                                  <span className="text-emerald-400 text-[10px] font-medium bg-emerald-400/10 px-1.5 py-0.5 rounded-full flex-shrink-0">Client</span>
                                  <span className="text-slate-600 text-xs flex-shrink-0">
                                    {file.size < 1024 * 1024
                                      ? `${(file.size / 1024).toFixed(0)} Ko`
                                      : `${(file.size / (1024 * 1024)).toFixed(1)} Mo`}
                                  </span>
                                  <a
                                    href={file.url}
                                    target="_blank" rel="noopener noreferrer"
                                    className="text-slate-500 hover:text-white transition-colors flex-shrink-0"
                                  >
                                    <ExternalLink size={12} />
                                  </a>
                                </div>
                              ))}
                              {manualDocs.map(doc => (
                                <div key={doc.id} className="flex items-center gap-2 group py-1">
                                  <Link2 size={12} className="text-slate-600 flex-shrink-0" />
                                  <a
                                    href={doc.url}
                                    target="_blank" rel="noopener noreferrer"
                                    className="flex-1 text-sm text-slate-300 hover:text-white truncate transition-colors"
                                  >
                                    {doc.name}
                                  </a>
                                  <span className="text-slate-600 text-xs flex-shrink-0">{doc.uploadedBy.name}</span>
                                  <button
                                    onClick={() => handleDeleteDoc(doc.id)}
                                    className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all flex-shrink-0"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          )
        })()}

        {/* ════════════════════════════════════════════════════════════════════
            LIENS
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'liens' && (
          <div className="max-w-2xl space-y-4">
            {/* Figma */}
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Figma size={16} className="text-[#E14B89]" />
                  <h3 className="text-white font-medium">Maquettes Figma</h3>
                </div>
                {canEditFigma && (
                  <button
                    onClick={() => { setEditingFigma(!editingFigma); setFigmaInput(project.figmaUrl ?? '') }}
                    className="text-slate-500 hover:text-white transition-colors"
                  >
                    <Pencil size={13} />
                  </button>
                )}
              </div>
              {editingFigma ? (
                <div className="flex gap-2">
                  <input
                    value={figmaInput}
                    onChange={e => setFigmaInput(e.target.value)}
                    placeholder="https://www.figma.com/file/..."
                    className="flex-1 bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                  />
                  <button onClick={saveFigmaUrl} className="bg-[#E14B89] hover:opacity-90 text-white px-4 py-2 rounded-xl text-sm transition-colors">
                    <Save size={14} />
                  </button>
                  <button onClick={() => setEditingFigma(false)} className="border border-slate-700 text-slate-400 hover:text-white px-3 py-2 rounded-xl text-sm transition-colors">
                    <X size={14} />
                  </button>
                </div>
              ) : project.figmaUrl ? (
                <a
                  href={project.figmaUrl}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-[#1a1a2e] border border-[#E14B89]/20 hover:border-[#E14B89]/50 text-white px-4 py-3 rounded-xl text-sm font-medium transition-colors"
                >
                  <Figma size={16} className="text-[#E14B89] flex-shrink-0" />
                  <span className="truncate flex-1">{project.figmaUrl}</span>
                  <ExternalLink size={12} className="text-slate-500 flex-shrink-0" />
                </a>
              ) : (
                <p className="text-slate-500 text-sm">
                  {canEditFigma ? 'Aucun lien Figma — cliquez sur ✏️ pour en ajouter un.' : 'Aucun lien Figma disponible.'}
                </p>
              )}
            </div>

            {/* Contenu rédactionnel */}
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileCheck size={16} className="text-teal-400" />
                  <h3 className="text-white font-medium">Contenu rédactionnel</h3>
                </div>
                {canEditContent && (
                  <button
                    onClick={() => { setEditingContent(!editingContent); setContentInput(project.contentUrl ?? '') }}
                    className="text-slate-500 hover:text-white transition-colors"
                  >
                    <Pencil size={13} />
                  </button>
                )}
              </div>
              {editingContent ? (
                <div className="flex gap-2">
                  <input
                    value={contentInput}
                    onChange={e => setContentInput(e.target.value)}
                    placeholder="https://docs.google.com/... ou Notion, Drive..."
                    className="flex-1 bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                  />
                  <button onClick={saveContentUrl} className="bg-[#E14B89] hover:opacity-90 text-white px-4 py-2 rounded-xl text-sm transition-colors">
                    <Save size={14} />
                  </button>
                  <button onClick={() => setEditingContent(false)} className="border border-slate-700 text-slate-400 hover:text-white px-3 py-2 rounded-xl text-sm transition-colors">
                    <X size={14} />
                  </button>
                </div>
              ) : project.contentUrl ? (
                project.contentUrl.startsWith('/redaction/') ? (
                  <Link
                    href={project.contentUrl}
                    className="flex items-center gap-3 bg-teal-500/5 border border-teal-500/20 hover:border-teal-500/40 text-white px-4 py-3 rounded-xl text-sm font-medium transition-colors"
                  >
                    <FileCheck size={16} className="text-teal-400 flex-shrink-0" />
                    <span className="truncate flex-1">Rédaction SEO</span>
                    <ChevronRight size={12} className="text-slate-500 flex-shrink-0" />
                  </Link>
                ) : (
                  <a
                    href={project.contentUrl}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 bg-teal-500/5 border border-teal-500/20 hover:border-teal-500/40 text-white px-4 py-3 rounded-xl text-sm font-medium transition-colors"
                  >
                    <FileCheck size={16} className="text-teal-400 flex-shrink-0" />
                    <span className="truncate flex-1">{project.contentUrl}</span>
                    <ExternalLink size={12} className="text-slate-500 flex-shrink-0" />
                  </a>
                )
              ) : (
                <p className="text-slate-500 text-sm">
                  {canEditContent ? 'Aucun contenu — cliquez sur ✏️ pour ajouter un lien.' : 'Contenu pas encore disponible.'}
                </p>
              )}
            </div>

            {/* Site client */}
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Globe size={16} className="text-blue-400" />
                <h3 className="text-white font-medium">Site du client</h3>
              </div>
              {project.client.website ? (
                <a
                  href={project.client.website}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-blue-500/5 border border-blue-500/20 hover:border-blue-500/40 text-white px-4 py-3 rounded-xl text-sm font-medium transition-colors"
                >
                  <Globe size={16} className="text-blue-400 flex-shrink-0" />
                  <span className="truncate flex-1">{project.client.website}</span>
                  <ExternalLink size={12} className="text-slate-500 flex-shrink-0" />
                </a>
              ) : (
                <p className="text-slate-500 text-sm">Aucun site web renseigné pour ce client.</p>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            ÉQUIPE
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'equipe' && (
          <div className="max-w-2xl space-y-5">
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Users2 size={18} className="text-[#E14B89]" />
                  <h2 className="text-white font-semibold text-lg">Équipe projet</h2>
                  <span className="text-slate-500 text-xs ml-1">{project.assignments.length} membre{project.assignments.length > 1 ? 's' : ''}</span>
                </div>
                {isAdmin && unassignedUsers.length > 0 && (
                  <button
                    onClick={() => { setAddMemberForm({ userId: '', price: '', deadline: '' }); setShowAddMemberModal(true) }}
                    className="flex items-center gap-1.5 text-[#E14B89] hover:text-[#F8903C] text-sm transition-colors"
                  >
                    <Plus size={15} /> Ajouter un membre
                  </button>
                )}
              </div>

              {project.assignments.length === 0 ? (
                <div className="text-center py-10">
                  <Users2 size={32} className="text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">Aucun membre assigné à ce projet</p>
                  <p className="text-slate-600 text-xs mt-1">Cliquez sur &quot;Ajouter un membre&quot; pour assigner des intervenants</p>
                </div>
              ) : (() => {
                const sorted = [...project.assignments].sort((a, b) => (ROLE_PRIORITY[a.user.role] ?? 99) - (ROLE_PRIORITY[b.user.role] ?? 99))
                return (
                <div className="space-y-3">
                  {sorted.map((a, idx) => {
                    const gradient = ROLE_AVATAR_COLORS[a.user.role] ?? 'from-slate-400 to-slate-600'
                    const statusColor = MISSION_STATUS_COLORS[a.status] ?? 'bg-slate-100 text-slate-700 border-slate-200'
                    const statusLabel = MISSION_STATUS_LABELS[a.status] ?? a.status
                    return (
                      <div key={a.id}>
                        {idx > 0 && (
                          <div className="flex justify-center py-1">
                            <div className={`w-px h-4 ${sorted[idx - 1].status === 'VALIDE' ? 'bg-[#E14B89]/40' : 'bg-slate-800'}`} />
                          </div>
                        )}
                        <div className="border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-colors group">
                        <div className="flex items-center gap-3">
                          <div className="relative flex-shrink-0">
                            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center overflow-hidden`}>
                              {a.user.avatar
                                ? <img src={a.user.avatar} alt="" className="w-full h-full object-cover" />
                                : <span className="text-white text-xs font-semibold">{a.user.name[0]?.toUpperCase()}</span>
                              }
                            </div>
                            <span className={`absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                              a.status === 'VALIDE' ? 'bg-[#E14B89] text-white' : 'bg-slate-700 text-slate-300'
                            }`}>{idx + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-white text-sm font-medium">{a.user.name}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${statusColor}`}>
                                {statusLabel}
                              </span>
                            </div>
                            <span className="text-slate-500 text-xs">{ROLE_LABELS[a.user.role] ?? a.user.role}</span>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            {a.price != null && a.user.role !== 'DESIGNER' && (
                              <div className="flex items-center gap-1 text-xs text-slate-400">
                                <DollarSign size={12} />
                                <span className="text-white font-medium">{formatCurrency(a.price)}</span>
                              </div>
                            )}
                            {a.deadline && (
                              <div className="flex items-center gap-1 text-xs text-slate-400">
                                <Clock size={12} />
                                <span className="text-white">{formatDate(a.deadline)}</span>
                              </div>
                            )}
                            {isAdmin && (
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                <button
                                  onClick={() => openEditAssignModal(a)}
                                  className="text-slate-600 hover:text-white p-1 transition-colors"
                                  title="Modifier la proposition"
                                >
                                  <Pencil size={13} />
                                </button>
                                {(a.status === 'VALIDE' || a.status === 'CONTRE_PROPOSITION' || a.status === 'REFUSE') && (
                                  <button
                                    onClick={() => handleResetAssignment(a.userId)}
                                    className="text-slate-600 hover:text-amber-400 p-1 transition-colors"
                                    title="Remettre en attente"
                                  >
                                    <Send size={13} />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleRemoveAssignee(a.userId)}
                                  className="text-slate-600 hover:text-red-400 p-1 transition-colors"
                                  title="Retirer du projet"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Counter-proposal section */}
                        {a.status === 'CONTRE_PROPOSITION' && (
                          <div className="mt-3 bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                            <div className="flex items-start gap-2 mb-2">
                              <MessageSquare size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
                              <span className="text-amber-300 text-xs font-medium">Contre-proposition de {a.user.name}</span>
                            </div>
                            <div className="flex items-center gap-4 text-xs mb-2 ml-5">
                              {a.counterPrice != null && (
                                <span className="text-white"><span className="text-slate-500">Prix :</span> {formatCurrency(a.counterPrice)}</span>
                              )}
                              {a.counterDeadline && (
                                <span className="text-white"><span className="text-slate-500">Deadline :</span> {formatDate(a.counterDeadline)}</span>
                              )}
                            </div>
                            {a.counterNote && (
                              <p className="text-slate-400 text-xs ml-5 mb-3">{a.counterNote}</p>
                            )}
                            {isAdmin && (
                              <div className="flex gap-2 ml-5">
                                <button
                                  onClick={() => handleReviewCounter(a.userId, 'accept')}
                                  className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                >
                                  Accepter
                                </button>
                                <button
                                  onClick={() => handleReviewCounter(a.userId, 'reject')}
                                  className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                >
                                  Refuser
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      </div>
                    )
                  })}
                </div>
                )
              })()}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            FACTURES
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'factures' && (
          <div className="max-w-3xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-white font-semibold text-lg">{isAdmin ? 'Factures par intervenant' : 'Ma facture'}</h2>
                <p className="text-slate-400 text-sm mt-0.5">
                  {isAdmin
                    ? `${invoices.length} facture${invoices.length > 1 ? 's' : ''} · ${project?.assignments.length ?? 0} intervenant${(project?.assignments.length ?? 0) > 1 ? 's' : ''}`
                    : `${invoices.filter(i => i.assigneeId === session?.user?.id).length} facture`
                  }
                </p>
              </div>
            </div>

            {(!project?.assignments || project.assignments.length === 0) ? (
              <div className="bg-[#111118] border border-slate-800 rounded-2xl p-14 text-center">
                <FileText size={32} className="text-slate-700 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">Aucun intervenant assigné à ce projet</p>
                <p className="text-slate-600 text-xs mt-1">Ajoutez des membres pour gérer les factures</p>
              </div>
            ) : (
              <div className="space-y-4">
                {[...project.assignments]
                  .filter(a => isAdmin || a.user.id === session?.user?.id)
                  .sort((a, b) => (ROLE_PRIORITY[a.user.role] ?? 99) - (ROLE_PRIORITY[b.user.role] ?? 99)).map(assignment => {
                  const inv = invoices.find(i => i.assigneeId === assignment.userId)
                  const gradientClass = ROLE_AVATAR_COLORS[assignment.user.role] || 'from-slate-400 to-slate-600'
                  return (
                    <div key={assignment.user.id} className="bg-[#111118] border border-slate-800 rounded-2xl overflow-hidden">
                      {/* Header: assignee info */}
                      <div className="flex items-center gap-3 p-4 border-b border-slate-800/50">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradientClass} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                          {assignment.user.avatar ? (
                            <img src={assignment.user.avatar} alt="" className="w-full h-full rounded-xl object-cover" />
                          ) : (
                            getInitials(assignment.user.name)
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium">{assignment.user.name}</p>
                          <p className="text-slate-500 text-xs">{ROLE_LABELS[assignment.user.role] || assignment.user.role}</p>
                        </div>
                        {inv && (isAdmin || assignment.user.id === session?.user?.id) && inv.amount && (
                          <span className="text-white font-semibold text-sm">{formatCurrency(inv.amount)}</span>
                        )}
                      </div>

                      {/* Content: invoice or empty state */}
                      {inv ? (
                        <div className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-[#E14B89]/10 flex items-center justify-center flex-shrink-0">
                              <FileText size={16} className="text-[#E14B89]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <a
                                href={inv.fileUrl}
                                target="_blank" rel="noopener noreferrer"
                                className="text-white text-sm font-medium hover:text-[#E14B89] transition-colors flex items-center gap-1.5"
                              >
                                {inv.filename}
                                <ExternalLink size={11} className="text-slate-500" />
                              </a>
                              <p className="text-slate-500 text-xs mt-0.5">
                                {formatDate(inv.createdAt)}{inv.notes ? ` · ${inv.notes}` : ''}
                              </p>
                            </div>
                            {(isAdmin || assignment.user.id === session?.user?.id) && (
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <button
                                  onClick={() => openInvoiceModal(assignment.user, inv)}
                                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors"
                                  title="Modifier"
                                >
                                  <Pencil size={13} />
                                </button>
                                {isAdmin && (
                                  <button
                                    onClick={() => handleDeleteInvoice(inv.id)}
                                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors"
                                    title="Supprimer"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="p-4">
                          {(isAdmin || assignment.user.id === session?.user?.id) ? (
                            <button
                              onClick={() => openInvoiceModal(assignment.user)}
                              className="w-full flex items-center justify-center gap-2 border border-dashed border-slate-700 hover:border-[#E14B89]/50 text-slate-500 hover:text-[#E14B89] py-3 rounded-xl text-sm transition-colors"
                            >
                              <Plus size={14} /> Ajouter la facture
                            </button>
                          ) : (
                            <p className="text-slate-600 text-xs text-center py-2">Aucune facture</p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Total */}
                {isAdmin && invoices.some(inv => inv.amount) && (
                  <div className="bg-[#111118] border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                    <span className="text-slate-400 text-sm font-medium">Total factures</span>
                    <span className="text-white font-bold text-lg">
                      {formatCurrency(invoices.reduce((sum, inv) => sum + (inv.amount ?? 0), 0))}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════════════════════════════════ */}

      {/* Document modal */}
      {showDocModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-white font-semibold text-lg mb-5">Ajouter un document</h2>
            <form onSubmit={handleCreateDoc} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Nom du document *</label>
                <input
                  required
                  value={docForm.name}
                  onChange={e => setDocForm({ ...docForm, name: e.target.value })}
                  placeholder="Ex : Charte graphique v2"
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Catégorie</label>
                <select
                  value={docForm.category}
                  onChange={e => setDocForm({ ...docForm, category: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                >
                  {DOC_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Lien (Drive, Notion, PDF…) *</label>
                <input
                  required
                  value={docForm.url}
                  onChange={e => setDocForm({ ...docForm, url: e.target.value })}
                  placeholder="https://drive.google.com/..."
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowDocModal(false)}
                  className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#E14B89] hover:opacity-90 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                  Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice modal */}
      {showInvoiceModal && invoiceTargetAssignee && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-white font-semibold text-lg mb-1">
              {editingInvoiceId ? 'Modifier la facture' : 'Ajouter une facture'}
            </h2>
            <p className="text-slate-500 text-sm mb-5">
              Pour {invoiceTargetAssignee.name} · {ROLE_LABELS[invoiceTargetAssignee.role] || invoiceTargetAssignee.role}
            </p>
            <form onSubmit={handleCreateInvoice} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Nom du fichier *</label>
                <input
                  required
                  value={invoiceForm.filename}
                  onChange={e => setInvoiceForm({ ...invoiceForm, filename: e.target.value })}
                  placeholder="Facture-2024-01.pdf"
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Lien Google Drive *</label>
                <input
                  required
                  value={invoiceForm.fileUrl}
                  onChange={e => setInvoiceForm({ ...invoiceForm, fileUrl: e.target.value })}
                  placeholder="https://drive.google.com/..."
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Montant (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={invoiceForm.amount}
                  onChange={e => setInvoiceForm({ ...invoiceForm, amount: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Notes</label>
                <input
                  value={invoiceForm.notes}
                  onChange={e => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowInvoiceModal(false); setInvoiceTargetAssignee(null); setEditingInvoiceId(null) }}
                  className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#E14B89] hover:opacity-90 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                  {editingInvoiceId ? 'Enregistrer' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Maintenance confirmation modal */}
      {showMaintenanceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-teal-500/15 flex items-center justify-center">
                <CheckCircle2 size={20} className="text-teal-400" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-lg">Passer en maintenance</h2>
                <p className="text-slate-500 text-sm">Confirmez que le projet est terminé</p>
              </div>
            </div>

            <div className="bg-teal-500/5 border border-teal-500/20 rounded-xl px-4 py-3 my-4">
              <p className="text-teal-300 text-sm">
                Le projet <strong>{project?.name}</strong> va passer en statut <strong>Maintenance</strong>. Renseignez les détails ci-dessous.
              </p>
            </div>

            <form onSubmit={handleConfirmMaintenance} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Type de maintenance *</label>
                <select
                  required
                  value={maintenanceForm.plan}
                  onChange={e => setMaintenanceForm({ ...maintenanceForm, plan: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                >
                  <option value="HEBERGEMENT">Hébergement web</option>
                  <option value="CLASSIQUE">Classique (hébergement + mises à jour)</option>
                  <option value="CONTENU">Contenu (classique + contenu)</option>
                  <option value="SEO">SEO (contenu + SEO)</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Prix mensuel (€) *</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  value={maintenanceForm.price}
                  onChange={e => setMaintenanceForm({ ...maintenanceForm, price: e.target.value })}
                  placeholder="59.99"
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Début *</label>
                  <input
                    required
                    type="date"
                    value={maintenanceForm.start}
                    onChange={e => setMaintenanceForm({ ...maintenanceForm, start: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Fin *</label>
                  <input
                    required
                    type="date"
                    value={maintenanceForm.end}
                    onChange={e => setMaintenanceForm({ ...maintenanceForm, end: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMaintenanceModal(false)}
                  className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={maintenanceSubmitting}
                  className="flex-1 bg-teal-500 hover:bg-teal-600 text-white py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-60"
                >
                  {maintenanceSubmitting ? 'Enregistrement...' : 'Confirmer la maintenance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Step-back from maintenance confirmation modal */}
      {showStepBackModal && stepBackTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-orange-500/15 flex items-center justify-center">
                <AlertTriangle size={20} className="text-orange-400" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-lg">Revenir en arrière ?</h2>
                <p className="text-slate-500 text-sm">Ce projet est actuellement en maintenance</p>
              </div>
            </div>

            <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl px-4 py-3 my-4">
              <p className="text-orange-300 text-sm">
                Vous êtes sur le point de faire passer le projet <strong>{project?.name}</strong> de <strong>Maintenance</strong> à <strong>{PROJECT_STATUS_LABELS[stepBackTarget]}</strong>. Cette action est inhabituelle et pourrait impacter le suivi du projet.
              </p>
            </div>

            <p className="text-slate-400 text-sm mb-5">Êtes-vous vraiment sûr de vouloir continuer ?</p>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowStepBackModal(false); setStepBackTarget(null) }}
                className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors"
              >
                Non, annuler
              </button>
              <button
                onClick={confirmStepBack}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                Oui, revenir en arrière
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add member modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-white font-semibold text-lg mb-5">Ajouter un membre</h2>
            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Membre *</label>
                <select
                  required
                  value={addMemberForm.userId}
                  onChange={e => setAddMemberForm({ ...addMemberForm, userId: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                >
                  <option value="">Sélectionner un membre</option>
                  {unassignedUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.name} — {ROLE_LABELS[u.role] ?? u.role}</option>
                  ))}
                </select>
              </div>
              {addMemberForm.userId && (() => {
                const selectedUser = users.find(u => u.id === addMemberForm.userId)
                if (selectedUser?.role === 'DESIGNER') return null
                return (
                  <div>
                    <label className="block text-slate-400 text-xs mb-1.5">Prix (EUR)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={addMemberForm.price}
                      onChange={e => setAddMemberForm({ ...addMemberForm, price: e.target.value })}
                      placeholder="Ex : 500"
                      className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                    />
                  </div>
                )
              })()}
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Délai (jours)</label>
                <input
                  type="number"
                  min="1"
                  value={addMemberForm.deadline}
                  onChange={e => setAddMemberForm({ ...addMemberForm, deadline: e.target.value })}
                  placeholder="Ex : 30"
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                />
                {addMemberForm.deadline && (() => {
                  const days = parseInt(addMemberForm.deadline)
                  if (isNaN(days) || days <= 0) return null
                  const selectedUser = users.find(u => u.id === addMemberForm.userId)
                  const selectedPriority = ROLE_PRIORITY[selectedUser?.role ?? ''] ?? 99
                  const sorted = [...(project?.assignments ?? [])].sort((a, b) => (ROLE_PRIORITY[a.user.role] ?? 99) - (ROLE_PRIORITY[b.user.role] ?? 99))
                  const prevAssignment = sorted.filter(a => (ROLE_PRIORITY[a.user.role] ?? 99) < selectedPriority).pop()
                  const startFrom = prevAssignment?.deadline ? new Date(prevAssignment.deadline) : new Date()
                  const deadlineDate = new Date(startFrom)
                  deadlineDate.setDate(deadlineDate.getDate() + days)
                  return (
                    <p className="text-slate-600 text-[10px] mt-1">
                      {prevAssignment ? `→ Après ${prevAssignment.user.name} · ` : '→ '}Deadline : {deadlineDate.toLocaleDateString('fr-FR')}
                    </p>
                  )
                })()}
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={addMemberSubmitting}
                  className="flex-1 bg-[#E14B89] hover:opacity-90 text-white py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-60"
                >
                  {addMemberSubmitting ? 'Ajout...' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit assignment modal (admin) */}
      {showEditAssignModal && editAssignTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-blue-500/15 flex items-center justify-center">
                <Pencil size={20} className="text-blue-400" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-lg">Modifier la proposition</h2>
                <p className="text-slate-500 text-sm">{editAssignTarget.user.name}</p>
              </div>
            </div>
            <form onSubmit={handleEditAssignment} className="space-y-4 mt-4">
              {editAssignTarget.user.role !== 'DESIGNER' && (
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Prix (EUR)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editAssignForm.price}
                    onChange={e => setEditAssignForm({ ...editAssignForm, price: e.target.value })}
                    placeholder="Ex : 500"
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                  />
                </div>
              )}
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Deadline</label>
                <input
                  type="date"
                  value={editAssignForm.deadline}
                  onChange={e => setEditAssignForm({ ...editAssignForm, deadline: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                />
                {(() => {
                  const sorted = [...(project?.assignments ?? [])].sort((a, b) => (ROLE_PRIORITY[a.user.role] ?? 99) - (ROLE_PRIORITY[b.user.role] ?? 99))
                  const myPriority = ROLE_PRIORITY[editAssignTarget.user.role] ?? 99
                  const prev = sorted.filter(a => (ROLE_PRIORITY[a.user.role] ?? 99) < myPriority).pop()
                  const next = sorted.find(a => (ROLE_PRIORITY[a.user.role] ?? 99) > myPriority)
                  return (prev || next) ? (
                    <p className="text-slate-600 text-[10px] mt-1">
                      {prev?.deadline && `Après ${prev.user.name} (${formatDate(prev.deadline)})`}
                      {prev?.deadline && next?.deadline && ' · '}
                      {next?.deadline && `Avant ${next.user.name} (${formatDate(next.deadline)})`}
                    </p>
                  ) : null
                })()}
              </div>
              {editAssignTarget.status !== 'EN_ATTENTE' && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                  <p className="text-amber-300 text-xs">
                    Statut actuel : <span className="font-medium">{MISSION_STATUS_LABELS[editAssignTarget.status] ?? editAssignTarget.status}</span>
                  </p>
                  <p className="text-slate-500 text-[11px] mt-1">
                    Enregistrer remettra automatiquement la mission en attente pour que le développeur puisse répondre à la nouvelle proposition.
                  </p>
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowEditAssignModal(false)}
                  className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={editAssignSubmitting}
                  className="flex-1 bg-[#E14B89] hover:opacity-90 text-white py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-60"
                >
                  {editAssignSubmitting ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Counter-proposal modal */}
      {showCounterModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center">
                <MessageSquare size={20} className="text-amber-400" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-lg">Contre-proposition</h2>
                <p className="text-slate-500 text-sm">Proposez vos conditions</p>
              </div>
            </div>
            <form onSubmit={handleSubmitCounter} className="space-y-4 mt-4">
              {userRole !== 'DESIGNER' && (
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Prix proposé (EUR)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={counterForm.price}
                    onChange={e => setCounterForm({ ...counterForm, price: e.target.value })}
                    placeholder="Ex : 600"
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                  />
                </div>
              )}
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Deadline proposée</label>
                <input
                  type="date"
                  value={counterForm.deadline}
                  onChange={e => setCounterForm({ ...counterForm, deadline: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Note / justification</label>
                <textarea
                  value={counterForm.note}
                  onChange={e => setCounterForm({ ...counterForm, note: e.target.value })}
                  rows={3}
                  placeholder="Expliquez votre contre-proposition..."
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCounterModal(false)}
                  className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={counterSubmitting}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-60"
                >
                  {counterSubmitting ? 'Envoi...' : 'Envoyer la contre-proposition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
