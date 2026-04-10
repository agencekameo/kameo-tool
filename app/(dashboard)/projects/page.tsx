'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Search, Trash2, Globe, FileText, CheckCircle2, ChevronLeft, ChevronRight as ChevronRightIcon, X, AlertTriangle, Clock, Euro } from 'lucide-react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { PROJECT_STATUS_COLORS, PROJECT_STATUS_LABELS, PROJECT_TYPE_COLORS, PROJECT_TYPE_LABELS, ROLE_LABELS, formatCurrency, formatDate } from '@/lib/utils'
import { usePolling } from '@/hooks/usePolling'

interface Project {
  id: string
  name: string
  type: string
  status: string
  price?: number
  deadline?: string
  services: string[]
  client: { id: string; name: string; company?: string }
  tasks: { id: string; status: string }[]
  assignments?: { user: { id: string; name: string; avatar?: string; role?: string }; deadline?: string; status?: string }[]
}

interface Client { id: string; name: string; firstName?: string; lastName?: string; company?: string; email?: string }

const IN_PROGRESS_STATUSES = ['BRIEF', 'REDACTION', 'MAQUETTE', 'DEVELOPPEMENT', 'INTEGRATION', 'OPTIMISATIONS', 'TESTING', 'CONCEPTION', 'REVIEW']
const DONE_STATUSES = ['LIVRAISON', 'MAINTENANCE', 'ARCHIVE']
const PRESTATIONS = ['Site web', 'Web app', 'Branding']

const KANBAN_COLUMNS = [
  { key: 'BRIEF', label: 'Pas validé', color: 'text-slate-400', bg: 'bg-slate-800/40' },
  { key: 'REDACTION', label: 'Rédaction', color: 'text-blue-400', bg: 'bg-blue-400/5' },
  { key: 'MAQUETTE', label: 'Maquette', color: 'text-purple-400', bg: 'bg-purple-400/5' },
  { key: 'DEVELOPPEMENT', label: 'Développement', color: 'text-amber-400', bg: 'bg-amber-400/5' },
  { key: 'INTEGRATION', label: 'Intégration', color: 'text-cyan-400', bg: 'bg-cyan-400/5' },
  { key: 'OPTIMISATIONS', label: 'Optimisations', color: 'text-orange-400', bg: 'bg-orange-400/5' },
  { key: 'TESTING', label: 'Testing', color: 'text-teal-400', bg: 'bg-teal-400/5' },
  { key: 'REVIEW', label: 'Review', color: 'text-[#E14B89]', bg: 'bg-[#E14B89]/5' },
]

function getDeadlineStatus(deadline?: string): 'overdue' | 'warning' | 'ok' | null {
  if (!deadline) return null
  const now = new Date()
  const dl = new Date(deadline)
  const diffDays = Math.ceil((dl.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'overdue'
  if (diffDays <= 7) return 'warning'
  return 'ok'
}

function getAssignmentDeadlineWarning(assignments?: Project['assignments']): 'overdue' | 'warning' | null {
  if (!assignments) return null
  const now = new Date()
  let hasOverdue = false
  let hasWarning = false
  for (const a of assignments) {
    if (!a.deadline) continue
    const dl = new Date(a.deadline)
    const diffDays = Math.ceil((dl.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays < 0 && a.status !== 'TERMINE') hasOverdue = true
    else if (diffDays <= 3 && a.status !== 'TERMINE') hasWarning = true
  }
  if (hasOverdue) return 'overdue'
  if (hasWarning) return 'warning'
  return null
}

const PRESTATION_ROLES: Record<string, string[]> = {
  'Site web': ['DESIGNER', 'DEVELOPER', 'REDACTEUR'],
  'Web app': ['DESIGNER', 'ADMIN'],
  'Branding': ['DESIGNER'],
}

interface BrandingCdcData {
  styleSouhaite?: string
  exemplesMarques?: string
  couleurs?: string
  ambiance?: string
  autresInfos?: string
}

interface CdcData {
  siteType: 'VITRINE' | 'ECOMMERCE'
  isRefonte: boolean
  siteActuel?: string
  arborescence?: string
  espaceClient?: boolean
  fonctionnalites?: string[]
  catalogueInfo?: string
  livraisonInfo?: string
  paiementInfo?: string
  autresInfos?: string
}

const FONCTIONNALITES_OPTIONS = [
  'Blog', 'Traduction multilingue', 'Newsletter',
  'RDV Calendly', 'Système de réservation', 'Simulateur',
  'Livechat',
]

interface TeamUser { id: string; name: string; role: string; avatar?: string }
interface AssigneeEntry { userId: string; price: string; deadline: string }

export default function ProjectsPage() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const isAdmin = (session?.user as { role?: string })?.role === 'ADMIN'

  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('EN_COURS')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [createError, setCreateError] = useState('')
  const [form, setForm] = useState({
    name: '', clientId: '', type: 'WORDPRESS', status: 'BRIEF',
    services: [] as string[], assignees: [] as AssigneeEntry[],
    signedAt: new Date().toISOString().slice(0, 7),
  })
  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1)
  const [createdProjectData, setCreatedProjectData] = useState<{ id: string; name: string; formToken: string } | null>(null)
  const [sendingFormEmail, setSendingFormEmail] = useState(false)
  const [formEmailSent, setFormEmailSent] = useState(false)
  const [cdc, setCdc] = useState<CdcData>({ siteType: 'VITRINE', isRefonte: false, fonctionnalites: [] })
  const [brandingCdc, setBrandingCdc] = useState<BrandingCdcData>({})
  const [prospectHasCdc, setProspectHasCdc] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [showClientDropdown, setShowClientDropdown] = useState(false)

  const [deleteModal, setDeleteModal] = useState<{ project: Project; step: 1 | 2 } | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)

  function pollData() {
    fetch('/api/projects').then(r => r.json()).then(p => setProjects(p))
  }
  usePolling(pollData)

  useEffect(() => {
    Promise.all([
      fetch('/api/projects').then(r => r.json()),
      fetch('/api/clients').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
    ]).then(([p, c, u]) => {
      setProjects(p); setClients(c); setTeamUsers(u)
      // Auto-open creation modal from prospect redirect
      if (searchParams.get('newProject') === 'true') {
        const prospectName = searchParams.get('prospectName') || ''
        const prospectCompany = searchParams.get('prospectCompany') || ''
        const prospectId = searchParams.get('prospectId') || ''
        // Try to find existing client by company name
        const matchClient = (c as Client[]).find(
          cl => prospectCompany && cl.company?.toLowerCase() === prospectCompany.toLowerCase()
        )
        setForm(f => ({
          ...f,
          name: prospectCompany ? `Site ${prospectCompany}` : `Projet ${prospectName}`,
          clientId: matchClient?.id || '',
        }))
        if (matchClient) {
          setClientSearch(matchClient.name || matchClient.company || '')
        }
        // Fetch prospect CDC data if available
        if (prospectId) {
          fetch(`/api/prospects/${prospectId}`).then(r => r.ok ? r.json() : null).then(prospect => {
            if (prospect?.cdcData) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const data = prospect.cdcData as any
              if (data.missionType) setForm(f => ({ ...f, services: [data.missionType] }))
              if (data.technologie) setForm(f => ({ ...f, type: data.technologie }))
              setCdc({
                siteType: data.siteType || 'VITRINE',
                isRefonte: data.isRefonte || false,
                arborescence: data.arborescence || '',
                espaceClient: data.espaceClient || false,
                fonctionnalites: data.fonctionnalites || [],
                catalogueInfo: data.catalogueInfo || '',
                livraisonInfo: data.livraisonInfo || '',
                paiementInfo: data.paiementInfo || '',
                autresInfos: data.autresInfos || '',
              })
              setProspectHasCdc(true)
            }
          }).catch(() => {})
        }
        setShowModal(true)
        window.history.replaceState({}, '', '/projects')
      }
    }).finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = projects.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.client.name.toLowerCase().includes(search.toLowerCase())
    if (filterStatus === 'EN_COURS') return matchSearch && IN_PROGRESS_STATUSES.includes(p.status)
    if (filterStatus === 'TERMINES') return matchSearch && DONE_STATUSES.includes(p.status)
    if (filterStatus === 'AVEC_MAINTENANCE') return matchSearch && p.status === 'MAINTENANCE'
    if (filterStatus === 'SANS_MAINTENANCE') return matchSearch && DONE_STATUSES.includes(p.status) && p.status !== 'MAINTENANCE'
    return matchSearch && p.status === filterStatus
  })

  const inProgressCount = projects.filter(p => IN_PROGRESS_STATUSES.includes(p.status)).length
  const doneCount = projects.filter(p => DONE_STATUSES.includes(p.status)).length
  const isTerminesView = ['TERMINES', 'AVEC_MAINTENANCE', 'SANS_MAINTENANCE'].includes(filterStatus)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    if (form.assignees.length === 0) {
      setCreateError('Vous devez assigner au moins un membre de l\'équipe')
      return
    }
    setSubmitting(true)
    setCreateError('')
    try {
      const { assignees, ...projectData } = form
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...projectData, price: null, deadline: null, signedAt: projectData.signedAt ? `${projectData.signedAt}-01` : null }),
      })
      if (!res.ok) {
        const err = await res.json()
        setCreateError(err.error || 'Erreur lors de la création')
        return
      }
      const project = await res.json()
      // Assign team members with sequential deadlines (each starts after previous ends)
      for (const a of assignees) {
        const days = a.deadline ? parseInt(a.deadline) : 0
        await fetch(`/api/projects/${project.id}/assignees`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: a.userId,
            price: a.price ? parseFloat(a.price) : null,
            delayDays: days > 0 ? days : null,
            deadline: null,
          }),
        })
      }
      // Save CDC data via ClientForm
      let formToken = ''
      try {
        const formRes = await fetch(`/api/projects/${project.id}/form`)
        const formData = await formRes.json()
        formToken = formData.token
        await fetch(`/api/formulaire/${formData.token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cdcData: form.services[0] === 'Branding' ? brandingCdc : cdc }),
        })
      } catch { /* ignore */ }
      setProjects(prev => [project, ...prev])
      // Go to step 3: send form email
      setCreatedProjectData({ id: project.id, name: project.name, formToken })
      setFormEmailSent(false)
      setCreateStep(3)
    } finally {
      setSubmitting(false)
    }
  }

  function toggleAssignee(userId: string) {
    setForm(f => {
      const exists = f.assignees.find(a => a.userId === userId)
      if (exists) {
        return { ...f, assignees: f.assignees.filter(a => a.userId !== userId) }
      }
      return { ...f, assignees: [...f.assignees, { userId, price: '', deadline: '' }] }
    })
  }

  function toggleFonctionnalite(f: string) {
    setCdc(prev => ({
      ...prev,
      fonctionnalites: prev.fonctionnalites?.includes(f)
        ? prev.fonctionnalites.filter(x => x !== f)
        : [...(prev.fonctionnalites || []), f],
    }))
  }

  function updateAssignee(userId: string, field: 'price' | 'deadline', value: string) {
    setForm(f => ({
      ...f,
      assignees: f.assignees.map(a => a.userId === userId ? { ...a, [field]: value } : a),
    }))
  }

  const taskProgress = (tasks: { status: string }[]) => {
    if (!tasks.length) return 0
    return Math.round((tasks.filter(t => t.status === 'DONE').length / tasks.length) * 100)
  }

  function openDeleteModal(project: Project) {
    setDeleteModal({ project, step: 1 })
    setDeleteConfirmText('')
  }

  function closeDeleteModal() {
    setDeleteModal(null)
    setDeleteConfirmText('')
  }

  function advanceDeleteStep() {
    if (!deleteModal) return
    setDeleteModal({ ...deleteModal, step: 2 })
    setDeleteConfirmText('')
  }

  async function handleDelete() {
    if (!deleteModal) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/projects/${deleteModal.project.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'Erreur lors de la suppression')
        return
      }
      setProjects(prev => prev.filter(p => p.id !== deleteModal.project.id))
      closeDeleteModal()
    } finally {
      setDeleting(false)
    }
  }

  async function handleDrop(status: string) {
    if (!dragId) return
    const project = projects.find(p => p.id === dragId)
    if (!project || project.status === status) { setDragId(null); return }
    const res = await fetch(`/api/projects/${dragId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      const updated = await res.json()
      setProjects(prev => prev.map(p => p.id === dragId ? updated : p))
    }
    setDragId(null)
  }

  return (
    <div className="p-4 sm:p-8 flex flex-col min-h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 flex-shrink-0 gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Projets</h1>
          <p className="text-slate-400 text-sm mt-1">{inProgressCount} en cours · {doneCount} terminés</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
              className="bg-[#111118] border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#E14B89] transition-colors w-full sm:w-48" />
          </div>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
            <Plus size={16} /> Nouveau
          </button>
        </div>
      </div>

      {/* Filter tabs - centered */}
      <div className="flex justify-center mb-6">
        <div className="flex items-center bg-[#111118] border border-slate-800 rounded-xl p-1">
          <button onClick={() => setFilterStatus('EN_COURS')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${!isTerminesView ? 'bg-[#E14B89] text-white' : 'text-slate-400 hover:text-white'}`}>
            En cours
          </button>
          <button onClick={() => setFilterStatus('TERMINES')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${isTerminesView ? 'bg-[#E14B89] text-white' : 'text-slate-400 hover:text-white'}`}>
            Terminés
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-slate-500 text-sm">Chargement...</div>
      ) : !isTerminesView ? (
        /* ── Grouped list view (En cours) ── */
        <div className="flex-1 overflow-y-auto space-y-4 pb-4">
          {KANBAN_COLUMNS.map(col => {
            const colProjects = projects.filter(p =>
              p.status === col.key &&
              (p.name.toLowerCase().includes(search.toLowerCase()) || p.client.name.toLowerCase().includes(search.toLowerCase()))
            )
            if (colProjects.length === 0) return null
            return (
              <div key={col.key}
                onDragOver={e => e.preventDefault()}
                onDrop={() => handleDrop(col.key)}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className={`text-xs font-semibold ${col.color}`}>{col.label}</span>
                  <span className="text-[10px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded-full">{colProjects.length}</span>
                  <div className="flex-1 h-px bg-slate-800/50" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2">
                  {colProjects.map(project => {
                    const progress = taskProgress(project.tasks)
                    const dlStatus = getDeadlineStatus(project.deadline)
                    const assignmentWarning = getAssignmentDeadlineWarning(project.assignments)
                    const worstWarning = dlStatus === 'overdue' || assignmentWarning === 'overdue' ? 'overdue'
                      : dlStatus === 'warning' || assignmentWarning === 'warning' ? 'warning' : null
                    return (
                      <div key={project.id} draggable onDragStart={() => setDragId(project.id)}
                        className={`bg-[#111118] border rounded-xl p-3 cursor-grab active:cursor-grabbing hover:border-slate-700 transition-colors group ${
                          worstWarning === 'overdue' ? 'border-red-500/50' : worstWarning === 'warning' ? 'border-amber-500/50' : 'border-slate-800'
                        }`}>
                        <div className="flex items-start gap-3">
                          {/* Left: info */}
                          <div className="flex-1 min-w-0">
                            <Link href={`/projects/${project.id}`} className="block">
                              <p className="text-white text-sm font-medium truncate hover:text-[#E14B89] transition-colors">{project.name}</p>
                            </Link>
                            <p className="text-slate-500 text-xs truncate mt-0.5">
                              {project.client.name} · {PROJECT_TYPE_LABELS[project.type]}
                            </p>
                            <div className="flex items-center gap-3 mt-1.5">
                              {project.deadline && (
                                <span className={`text-[10px] flex items-center gap-1 ${dlStatus === 'overdue' ? 'text-red-400' : dlStatus === 'warning' ? 'text-amber-400' : 'text-slate-500'}`}>
                                  <Clock size={9} />{formatDate(project.deadline)}
                                </span>
                              )}
                              {project.price && (
                                <span className="text-[10px] text-slate-500">{formatCurrency(project.price)}</span>
                              )}
                              {worstWarning && (
                                <span className={`text-[10px] flex items-center gap-0.5 ${worstWarning === 'overdue' ? 'text-red-400' : 'text-amber-400'}`}>
                                  <AlertTriangle size={9} />
                                  {worstWarning === 'overdue' ? 'En retard' : 'Bientôt'}
                                </span>
                              )}
                            </div>
                          </div>
                          {/* Right: progress + avatars */}
                          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                            {project.tasks.length > 0 && (
                              <div className="w-16">
                                <div className="flex justify-between text-[9px] text-slate-600 mb-0.5">
                                  <span>{project.tasks.filter(t => t.status === 'DONE').length}/{project.tasks.length}</span>
                                  <span>{progress}%</span>
                                </div>
                                <div className="h-1 bg-slate-800 rounded-full">
                                  <div className="h-full bg-[#E14B89] rounded-full" style={{ width: `${progress}%` }} />
                                </div>
                              </div>
                            )}
                            {project.assignments && project.assignments.length > 0 && (
                              <div className="flex -space-x-1">
                                {project.assignments.slice(0, 3).map(a => (
                                  a.user.avatar ? (
                                    <img key={a.user.id} src={a.user.avatar} alt={a.user.name} title={a.user.name}
                                      className="w-5 h-5 rounded-full border border-[#111118] object-cover" />
                                  ) : (
                                    <div key={a.user.id} title={a.user.name}
                                      className="w-5 h-5 rounded-full border border-[#111118] bg-slate-700 flex items-center justify-center text-[7px] font-bold text-white">
                                      {a.user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                                    </div>
                                  )
                                ))}
                                {project.assignments.length > 3 && (
                                  <span className="text-[9px] text-slate-600 ml-1">+{project.assignments.length - 3}</span>
                                )}
                              </div>
                            )}
                            {isAdmin && (
                              <button onClick={() => openDeleteModal(project)}
                                className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-600 hover:text-red-400 transition-all">
                                <Trash2 size={10} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {projects.filter(p => IN_PROGRESS_STATUSES.includes(p.status)).length === 0 && (
            <div className="text-center py-16 text-slate-500">Aucun projet en cours</div>
          )}
        </div>
      ) : (
        /* ── List view (Terminés) ── */
        <div className="flex-1 overflow-y-auto">
          <div className="flex gap-2 mb-4">
            <button onClick={() => setFilterStatus('TERMINES')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === 'TERMINES' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
              Tous
            </button>
            <button onClick={() => setFilterStatus('AVEC_MAINTENANCE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === 'AVEC_MAINTENANCE' ? 'bg-[#E14B89] text-white' : 'text-slate-400 hover:text-white'}`}>
              Avec maintenance
            </button>
            <button onClick={() => setFilterStatus('SANS_MAINTENANCE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === 'SANS_MAINTENANCE' ? 'bg-[#E14B89] text-white' : 'text-slate-400 hover:text-white'}`}>
              Sans maintenance
            </button>
          </div>
          <div className="space-y-3">
            {filtered.map(project => {
              const progress = taskProgress(project.tasks)
              return (
                <div key={project.id} className="flex items-center gap-0 group">
                  <Link href={`/projects/${project.id}`}
                    className="flex-1 grid grid-cols-[1fr_auto] sm:grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-3 sm:gap-5 bg-[#111118] border border-slate-800 rounded-2xl px-4 sm:px-5 py-4 hover:border-slate-700 transition-colors min-w-0">
                    <span className={`text-xs px-3.5 py-1.5 rounded-full font-semibold whitespace-nowrap ${PROJECT_STATUS_COLORS[project.status]}`}>
                      {PROJECT_STATUS_LABELS[project.status]}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-white font-medium truncate group-hover:text-[#F8903C] transition-colors">{project.name}</h3>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 font-medium flex-shrink-0">
                          {PROJECT_TYPE_LABELS[project.type]}
                        </span>
                      </div>
                      <p className="text-slate-500 text-xs truncate">{project.client.name}{project.client.company ? ` · ${project.client.company}` : ''}</p>
                    </div>
                    <div className="flex -space-x-1.5 flex-shrink-0">
                      {project.assignments && project.assignments.length > 0 ? (
                        <>
                          {project.assignments.slice(0, 5).map(a => (
                            a.user.avatar ? (
                              <img key={a.user.id} src={a.user.avatar} alt={a.user.name} title={a.user.name}
                                className="w-6 h-6 rounded-full border-2 border-[#111118] object-cover" />
                            ) : (
                              <div key={a.user.id} title={a.user.name}
                                className="w-6 h-6 rounded-full border-2 border-[#111118] bg-slate-700 flex items-center justify-center text-[8px] font-bold text-white">
                                {a.user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                              </div>
                            )
                          ))}
                        </>
                      ) : <div className="w-6" />}
                    </div>
                    {project.tasks.length > 0 ? (
                      <div className="w-24 flex-shrink-0">
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                          <span>Tâches</span><span>{progress}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-800 rounded-full">
                          <div className="h-full bg-[#E14B89] rounded-full" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    ) : <div className="w-24 flex-shrink-0" />}
                    <span className="text-slate-400 text-sm w-24 text-right flex-shrink-0">
                      {project.deadline ? formatDate(project.deadline) : ''}
                    </span>
                    <span className="text-white font-medium text-sm w-20 text-right flex-shrink-0">
                      {project.price ? formatCurrency(project.price) : ''}
                    </span>
                  </Link>
                  {isAdmin && (
                    <button onClick={() => openDeleteModal(project)}
                      className="ml-2 opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all p-2 rounded-lg hover:bg-red-400/10 flex-shrink-0">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              )
            })}
            {filtered.length === 0 && <div className="text-center py-16 text-slate-500">Aucun projet</div>}
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-md">
            {deleteModal.step === 1 ? (
              <>
                <h2 className="text-white font-semibold text-lg mb-3">Supprimer le projet ?</h2>
                <p className="text-slate-400 text-sm mb-6">
                  Êtes-vous sûr de vouloir supprimer &ldquo;{deleteModal.project.name}&rdquo; ? Cette action est irréversible.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closeDeleteModal}
                    className="border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm flex-1 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={advanceDeleteStep}
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium flex-1 transition-colors"
                  >
                    Oui, continuer
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-white font-semibold text-lg mb-3">Confirmation finale</h2>
                <p className="text-slate-400 text-sm mb-4">
                  Pour confirmer, tapez le nom du projet ci-dessous :
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder={deleteModal.project.name}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-red-500 transition-colors mb-6"
                  autoFocus
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closeDeleteModal}
                    className="border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm flex-1 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleteConfirmText !== deleteModal.project.name || deleting}
                    className="bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-medium flex-1 transition-colors"
                  >
                    {deleting ? 'Suppression...' : 'Supprimer définitivement'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto relative">

            {/* Close button */}
            <button type="button" onClick={() => { setShowModal(false); setCreateStep(1); setCreateError(''); setClientSearch('') }}
              className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors">
              <X size={18} />
            </button>

            {/* Step indicator */}
            <div className="flex items-center gap-3 mb-5 pr-8">
              <div className={`flex items-center gap-2 text-sm font-medium ${createStep === 1 ? 'text-white' : createStep > 1 ? 'text-green-400' : 'text-slate-500'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${createStep === 1 ? 'bg-[#E14B89] text-white' : createStep > 1 ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>{createStep > 1 ? '✓' : '1'}</div>
                Projet
              </div>
              <div className="flex-1 h-px bg-slate-700" />
              <div className={`flex items-center gap-2 text-sm font-medium ${createStep === 2 ? 'text-white' : createStep > 2 ? 'text-green-400' : 'text-slate-500'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${createStep === 2 ? 'bg-[#E14B89] text-white' : createStep > 2 ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>{createStep > 2 ? '✓' : '2'}</div>
                Mission
              </div>
              <div className="flex-1 h-px bg-slate-700" />
              <div className={`flex items-center gap-2 text-sm font-medium ${createStep === 3 ? 'text-white' : 'text-slate-500'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${createStep === 3 ? 'bg-[#E14B89] text-white' : 'bg-slate-700 text-slate-400'}`}>3</div>
                Formulaire
              </div>
            </div>

            {/* ── Step 1: Project info ── */}
            {createStep === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Nom du projet *</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Client *</label>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      value={clientSearch}
                      onChange={e => { setClientSearch(e.target.value); setShowClientDropdown(true); if (!e.target.value) setForm(f => ({ ...f, clientId: '' })) }}
                      onFocus={() => setShowClientDropdown(true)}
                      onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                      placeholder="Rechercher un client..."
                      className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl pl-9 pr-8 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                    />
                    {form.clientId && (
                      <button type="button" onClick={() => { setForm(f => ({ ...f, clientId: '' })); setClientSearch('') }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                        <X size={14} />
                      </button>
                    )}
                    {showClientDropdown && (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-[#1a1a24] border border-slate-700 rounded-xl max-h-40 overflow-y-auto shadow-lg">
                        {clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase())).map(c => (
                          <button key={c.id} type="button"
                            onMouseDown={() => { setForm(f => ({ ...f, clientId: c.id })); setClientSearch(c.name); setShowClientDropdown(false) }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-800 transition-colors first:rounded-t-xl last:rounded-b-xl ${form.clientId === c.id ? 'text-[#E14B89]' : 'text-slate-300'}`}>
                            {c.name}
                          </button>
                        ))}
                        {clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase())).length === 0 && (
                          <p className="px-3 py-2 text-slate-500 text-xs">Aucun client trouvé</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Mois de signature</label>
                  <input type="month" value={form.signedAt} onChange={e => setForm({ ...form, signedAt: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-2">Équipe projet *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {teamUsers.map(user => {
                      const entry = form.assignees.find(a => a.userId === user.id)
                      const isSelected = !!entry
                      const isDesigner = user.role === 'DESIGNER'
                      const isDeveloper = user.role === 'DEVELOPER'
                      const isAdmin = user.role === 'ADMIN'
                      return (
                        <div key={user.id} className={`rounded-xl border transition-colors ${isSelected ? 'bg-[#E14B89]/10 border-[#E14B89]/50' : 'border-slate-700 hover:border-slate-600'}`}>
                          <button type="button" onClick={() => toggleAssignee(user.id)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left">
                            {user.avatar ? (
                              <img src={user.avatar} alt={user.name} className={`w-8 h-8 rounded-lg object-cover flex-shrink-0 ${isSelected ? 'ring-2 ring-[#E14B89]' : ''}`} />
                            ) : (
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${isSelected ? 'bg-[#E14B89] text-white' : 'bg-slate-800 text-slate-400'}`}>
                                {user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-slate-300'}`}>{user.name}</p>
                              <p className="text-slate-500 text-xs">{ROLE_LABELS[user.role] || user.role}</p>
                            </div>
                            {isSelected && <span className="text-[#E14B89] text-xs font-medium">✓</span>}
                          </button>
                          {isSelected && !isAdmin && (
                            <div className="px-3 pb-3 space-y-2">
                              <div className="flex gap-3">
                                {!isDesigner && (
                                  <div className="flex-1">
                                    <label className="block text-slate-500 text-[10px] mb-1">Prix (€)</label>
                                    <input type="number" value={entry.price} onChange={e => updateAssignee(user.id, 'price', e.target.value)} placeholder="0"
                                      className="w-full bg-[#1a1a24] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-[#E14B89] transition-colors" />
                                  </div>
                                )}
                                <div className="flex-1">
                                  <label className="block text-slate-500 text-[10px] mb-1">Délai (jours)</label>
                                  <input type="number" min="1" value={entry.deadline} onChange={e => updateAssignee(user.id, 'deadline', e.target.value)} placeholder="Ex : 30"
                                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-[#E14B89] transition-colors" />
                                  {entry.deadline && (
                                    <p className="text-slate-600 text-[9px] mt-0.5">
                                      {(() => {
                                        const idx = form.assignees.findIndex(x => x.userId === user.id)
                                        const prevDays = form.assignees.slice(0, idx).reduce((sum, x) => sum + (parseInt(x.deadline) || 0), 0)
                                        const totalDays = prevDays + (parseInt(entry.deadline) || 0)
                                        return `→ J+${totalDays} après réception formulaire`
                                      })()}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {isDeveloper && (
                                <div>
                                  <label className="block text-slate-500 text-[10px] mb-1">Technologie</label>
                                  <div className="bg-[#1a1a24] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs">
                                    {PROJECT_TYPE_LABELS[form.type] || form.type}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
                {createError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">{createError}</div>
                )}

                <div className="pt-2">
                  <button type="button"
                    disabled={!form.name || !form.clientId || form.assignees.length === 0}
                    onClick={() => { setCreateError(''); setCreateStep(2) }}
                    className="w-full flex items-center justify-center gap-2 bg-[#E14B89] hover:opacity-90 text-white py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-40">
                    Suivant <ChevronRightIcon size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 2: Mission type + CDC form ── */}
            {createStep === 2 && (
              <form onSubmit={handleCreate} className="space-y-4">
                {/* Type de mission */}
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Type de mission *</label>
                  <select value={form.services[0] || ''} onChange={e => {
                    const val = e.target.value
                    setForm(f => ({ ...f, services: val ? [val] : [] }))
                  }}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                    <option value="">Sélectionner un type de mission</option>
                    {PRESTATIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                {/* Technologie */}
                {form.services[0] && form.services[0] !== 'Branding' && (
                  <div>
                    <label className="block text-slate-400 text-xs mb-1.5">Technologie</label>
                    <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                      className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                      <option value="WORDPRESS">WordPress</option>
                      <option value="FRAMER">Framer</option>
                      <option value="CUSTOM">Sur mesure</option>
                    </select>
                  </div>
                )}

                {/* CDC pre-fill indicator */}
                {prospectHasCdc && form.services[0] && form.services[0] !== 'Branding' && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-sm text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    Mission pré-remplie depuis le prospect. Vérifiez et validez.
                  </div>
                )}

                {!form.services[0] ? (
                  <p className="text-slate-500 text-xs py-2">Sélectionnez un type de mission pour afficher les détails</p>
                ) : form.services[0] === 'Branding' ? (
                  <>
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">Style souhaité</label>
                      <textarea value={brandingCdc.styleSouhaite || ''} onChange={e => setBrandingCdc(p => ({ ...p, styleSouhaite: e.target.value }))} rows={3}
                        placeholder="Moderne, minimaliste, luxe, playful, corporate..."
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none" />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">Marques / sites d&apos;exemple</label>
                      <textarea value={brandingCdc.exemplesMarques || ''} onChange={e => setBrandingCdc(p => ({ ...p, exemplesMarques: e.target.value }))} rows={3}
                        placeholder="Références visuelles qui vous inspirent..."
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none" />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">Couleurs souhaitées</label>
                      <textarea value={brandingCdc.couleurs || ''} onChange={e => setBrandingCdc(p => ({ ...p, couleurs: e.target.value }))} rows={2}
                        placeholder="Couleurs ou palette que vous aimeriez..."
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none" />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">Ambiance / valeurs</label>
                      <textarea value={brandingCdc.ambiance || ''} onChange={e => setBrandingCdc(p => ({ ...p, ambiance: e.target.value }))} rows={2}
                        placeholder="Quelle ambiance souhaitez-vous transmettre ?"
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none" />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">Informations complémentaires</label>
                      <textarea value={brandingCdc.autresInfos || ''} onChange={e => setBrandingCdc(p => ({ ...p, autresInfos: e.target.value }))} rows={2}
                        placeholder="Contraintes, délais, supports prévus..."
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none" />
                    </div>
                  </>
                ) : (
                  <>
                    {/* Type de projet */}
                    <div>
                      <label className="block text-slate-400 text-xs mb-2">Type de site *</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button type="button" onClick={() => setCdc(p => ({ ...p, siteType: 'VITRINE' }))}
                          className={`p-3 rounded-xl border-2 text-left transition-all ${cdc.siteType === 'VITRINE' ? 'border-[#E14B89] bg-[#E14B89]/5' : 'border-slate-800 hover:border-slate-700'}`}>
                          <Globe size={18} className={cdc.siteType === 'VITRINE' ? 'text-[#E14B89]' : 'text-slate-500'} />
                          <p className={`font-medium mt-1.5 text-sm ${cdc.siteType === 'VITRINE' ? 'text-white' : 'text-slate-400'}`}>Site vitrine</p>
                          <p className="text-slate-600 text-[10px] mt-0.5">Présentation, services, portfolio...</p>
                        </button>
                        <button type="button" onClick={() => setCdc(p => ({ ...p, siteType: 'ECOMMERCE' }))}
                          className={`p-3 rounded-xl border-2 text-left transition-all ${cdc.siteType === 'ECOMMERCE' ? 'border-[#E14B89] bg-[#E14B89]/5' : 'border-slate-800 hover:border-slate-700'}`}>
                          <FileText size={18} className={cdc.siteType === 'ECOMMERCE' ? 'text-[#E14B89]' : 'text-slate-500'} />
                          <p className={`font-medium mt-1.5 text-sm ${cdc.siteType === 'ECOMMERCE' ? 'text-white' : 'text-slate-400'}`}>E-commerce</p>
                          <p className="text-slate-600 text-[10px] mt-0.5">Boutique en ligne, catalogue...</p>
                        </button>
                      </div>
                    </div>

                    {/* Refonte toggle */}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={cdc.isRefonte} onChange={e => setCdc(p => ({ ...p, isRefonte: e.target.checked }))}
                        className="w-4 h-4 rounded border-slate-700 bg-[#1a1a24] text-[#E14B89] focus:ring-[#E14B89] focus:ring-offset-0" />
                      <span className="text-slate-300 text-sm">Il s&apos;agit d&apos;une refonte (site existant)</span>
                    </label>

                    {/* Site actuel (si refonte) */}
                    {cdc.isRefonte && (
                      <div>
                        <label className="block text-slate-400 text-xs mb-1.5">Site internet actuel</label>
                        <input value={cdc.siteActuel || ''} onChange={e => setCdc(p => ({ ...p, siteActuel: e.target.value }))}
                          placeholder="https://www.exemple.fr"
                          className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                      </div>
                    )}

                    {/* Common fields */}
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">Arborescence du site</label>
                      <textarea value={cdc.arborescence || ''} onChange={e => setCdc(p => ({ ...p, arborescence: e.target.value }))} rows={3}
                        placeholder="Ex: Accueil, À propos, Services, Portfolio, Contact..."
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none" />
                    </div>
                    <div className="flex items-center justify-between bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3">
                      <div>
                        <p className="text-white text-sm font-medium">Espace client</p>
                        <p className="text-slate-500 text-[10px]">Connexion pour les utilisateurs ?</p>
                      </div>
                      <button type="button" onClick={() => setCdc(p => ({ ...p, espaceClient: !p.espaceClient }))}
                        className={`relative w-10 h-6 rounded-full transition-colors ${cdc.espaceClient ? 'bg-[#E14B89]' : 'bg-slate-700'}`}>
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${cdc.espaceClient ? 'left-5' : 'left-1'}`} />
                      </button>
                    </div>

                    {/* ECOMMERCE fields */}
                    {cdc.siteType === 'ECOMMERCE' && (
                      <>
                        <div>
                          <label className="block text-slate-400 text-xs mb-1.5">Catalogue produits</label>
                          <textarea value={cdc.catalogueInfo || ''} onChange={e => setCdc(p => ({ ...p, catalogueInfo: e.target.value }))} rows={3}
                            placeholder="Ex: 150 produits, 5 catégories, variables: taille et couleur..."
                            className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none" />
                        </div>
                        <div>
                          <label className="block text-slate-400 text-xs mb-1.5">Moyens de livraison</label>
                          <textarea value={cdc.livraisonInfo || ''} onChange={e => setCdc(p => ({ ...p, livraisonInfo: e.target.value }))} rows={2}
                            placeholder="Ex: Colissimo, Mondial Relay, Click & Collect..."
                            className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none" />
                        </div>
                        <div>
                          <label className="block text-slate-400 text-xs mb-1.5">Moyens de paiement</label>
                          <textarea value={cdc.paiementInfo || ''} onChange={e => setCdc(p => ({ ...p, paiementInfo: e.target.value }))} rows={2}
                            placeholder="Ex: Carte bancaire (Stripe), PayPal, Apple Pay..."
                            className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none" />
                        </div>
                      </>
                    )}

                    {/* Fonctionnalités */}
                    <div>
                      <label className="block text-slate-400 text-xs mb-2">Fonctionnalités souhaitées</label>
                      <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto pr-1">
                        {FONCTIONNALITES_OPTIONS.map(f => (
                          <button key={f} type="button" onClick={() => toggleFonctionnalite(f)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left transition-all ${
                              cdc.fonctionnalites?.includes(f) ? 'bg-[#E14B89]/10 border border-[#E14B89]/40 text-white' : 'bg-[#1a1a24] border border-slate-800 text-slate-400 hover:border-slate-700'
                            }`}>
                            <div className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${
                              cdc.fonctionnalites?.includes(f) ? 'bg-[#E14B89] border-[#E14B89]' : 'border-slate-600'
                            }`}>
                              {cdc.fonctionnalites?.includes(f) && <CheckCircle2 size={8} className="text-white" />}
                            </div>
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Autres infos */}
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">Informations complémentaires</label>
                      <textarea value={cdc.autresInfos || ''} onChange={e => setCdc(p => ({ ...p, autresInfos: e.target.value }))} rows={2}
                        placeholder="Contraintes, délais, budget, fonctionnalités spécifiques..."
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none" />
                    </div>
                  </>
                )}

                {createError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">{createError}</div>
                )}

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setCreateStep(1)}
                    className="flex items-center justify-center gap-1.5 flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors">
                    <ChevronLeft size={14} /> Retour
                  </button>
                  <button type="submit" disabled={submitting || !form.services.length}
                    className="flex-1 bg-gradient-to-r from-[#E14B89] to-[#F8903C] hover:opacity-90 text-white py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-60">
                    {submitting ? 'Création...' : 'Créer le projet'}
                  </button>
                </div>
              </form>
            )}

            {/* ── Step 3: Send form email to client ── */}
            {createStep === 3 && createdProjectData && (() => {
              const cl = clients.find(c => c.id === form.clientId)
              const clientFirstName = cl?.firstName || cl?.name?.split(' ')[0] || ''
              const clientEmail = cl?.email || ''
              const projectName = createdProjectData.name
              const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
              const formUrl = `${baseUrl}/formulaire/${createdProjectData.formToken}`

              function closeAndReset() {
                setShowModal(false)
                setCreateStep(1)
                setForm({ name: '', clientId: '', type: 'WORDPRESS', status: 'BRIEF', services: [], assignees: [], signedAt: new Date().toISOString().slice(0, 7) })
                setCdc({ siteType: 'VITRINE', isRefonte: false, fonctionnalites: [] })
                setBrandingCdc({})
                setProspectHasCdc(false)
                setClientSearch('')
                setCreatedProjectData(null)
              }

              async function handleSendFormEmail() {
                if (!clientEmail) { alert('Aucun email client renseigné.'); return }
                setSendingFormEmail(true)
                try {
                  await fetch('/api/email/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      to: clientEmail,
                      subject: `${projectName} — Formulaire de démarrage`,
                      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
<tr><td style="height:5px;background:linear-gradient(135deg,#E14B89 0%,#F8903C 100%);"></td></tr>
<tr><td align="center" style="padding:32px 40px 20px;"><img src="${baseUrl}/kameo-logo-light.svg" alt="Agence Kameo" height="32" style="height:32px;" /></td></tr>
<tr><td style="padding:0 40px 32px;">
<h1 style="font-size:22px;color:#1a1a2e;margin:0 0 20px;font-weight:600;">Formulaire de démarrage</h1>
<p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 16px;">Bonjour ${clientFirstName},</p>
<p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 16px;">Nous sommes ravis de démarrer votre projet <strong style="color:#1a1a2e;">${projectName}</strong> avec vous.</p>
<p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 16px;">Afin de commencer dans les meilleures conditions, nous avons besoin de quelques informations. Merci de remplir le formulaire ci-dessous :</p>
<div style="background:#f8f9fa;border-left:4px solid #F8903C;padding:14px 16px;border-radius:0 8px 8px 0;margin:0 0 24px;">
<p style="font-size:14px;color:#1a1a2e;margin:0;font-weight:600;">📋 Brief créatif · 🎨 Direction artistique · 🔑 Accès techniques · 📄 Documents</p>
</div>
<p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 28px;">Dès réception de vos réponses, nos équipes pourront commencer la réalisation de votre projet.</p>
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<a href="${formUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#E14B89 0%,#F8903C 100%);color:#fff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:600;">Remplir le formulaire</a>
</td></tr></table>
<p style="font-size:14px;color:#444;line-height:1.6;margin:24px 0 0;">N'hésitez pas à nous contacter pour toute question.</p>
<p style="font-size:13px;color:#888;margin:20px 0 0;text-align:center;">Ce formulaire est accessible à tout moment via le lien ci-dessus.</p>
</td></tr>
<tr><td style="padding:0 40px;"><div style="border-top:1px solid #eee;"></div></td></tr>
<tr><td style="padding:24px 40px 32px;text-align:center;">
<p style="font-size:12px;color:#aaa;margin:0;line-height:1.6;">Agence Kameo — 9 rue des colonnes, Paris 75002<br>contact@agencekameo.fr — 06 62 37 99 85</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`,
                    }),
                  })
                  setFormEmailSent(true)
                } catch {
                  alert('Erreur lors de l\'envoi.')
                } finally {
                  setSendingFormEmail(false)
                }
              }

              return (
                <div className="space-y-4">
                  {formEmailSent ? (
                    <div className="text-center py-6">
                      <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                        <CheckCircle2 size={28} className="text-green-400" />
                      </div>
                      <p className="text-green-400 font-medium">Formulaire envoyé à {clientEmail}</p>
                      <p className="text-slate-500 text-xs mt-2">Le client recevra un email avec le lien du formulaire.</p>
                      <button onClick={closeAndReset}
                        className="mt-5 bg-[#E14B89] hover:opacity-90 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors">
                        Terminé
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 size={16} className="text-green-400" />
                        <span className="text-green-400 text-sm font-medium">Projet créé avec succès</span>
                      </div>

                      <p className="text-slate-400 text-sm">Envoyer le formulaire de démarrage au client :</p>

                      {/* Email preview */}
                      <div className="bg-white rounded-xl overflow-hidden max-h-[280px] overflow-y-auto">
                        <div className="h-1" style={{ background: 'linear-gradient(135deg, #E14B89 0%, #F8903C 100%)' }} />
                        <div className="p-5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src="/kameo-logo-light.svg" alt="Kameo" className="h-6 mx-auto mb-4" />
                          <h3 className="text-gray-900 font-semibold text-base mb-3">Formulaire de démarrage</h3>
                          <p className="text-gray-600 text-sm mb-2">Bonjour {clientFirstName},</p>
                          <p className="text-gray-600 text-sm mb-3">
                            Nous sommes ravis de démarrer votre projet <strong className="text-gray-900">{projectName}</strong> avec vous.
                          </p>
                          <p className="text-gray-600 text-sm mb-3">
                            Afin de commencer dans les meilleures conditions, nous avons besoin de quelques informations.
                          </p>
                          <div className="bg-gray-50 px-4 py-3 rounded-lg mb-4 border-l-4" style={{ borderColor: '#F8903C' }}>
                            <p className="text-gray-800 text-sm font-medium">Brief créatif · Direction artistique · Accès techniques · Documents</p>
                          </div>
                          <p className="text-gray-600 text-sm mb-4">Dès réception de vos réponses, nos équipes pourront commencer la réalisation de votre projet.</p>
                          <div className="text-center">
                            <span className="inline-block text-white text-sm font-semibold px-6 py-2.5 rounded-lg" style={{ background: 'linear-gradient(135deg, #E14B89 0%, #F8903C 100%)' }}>
                              Remplir le formulaire
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Recipient info */}
                      <div className="bg-[#0d0d14] rounded-xl p-3 space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Destinataire</span>
                          <span className="text-white">{clientEmail || <span className="text-red-400">Aucun email client</span>}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Projet</span>
                          <span className="text-slate-300">{projectName}</span>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button onClick={closeAndReset}
                          className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors">
                          Plus tard
                        </button>
                        <button onClick={handleSendFormEmail}
                          disabled={sendingFormEmail || !clientEmail}
                          className="flex-1 bg-[#E14B89] hover:opacity-90 disabled:opacity-40 text-white py-2.5 rounded-xl text-sm font-medium transition-opacity flex items-center justify-center gap-2">
                          {sendingFormEmail ? 'Envoi...' : 'Envoyer le formulaire'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
