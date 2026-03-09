'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Search, Trash2, Globe, FileText, CheckCircle2, ChevronLeft, ChevronRight as ChevronRightIcon, X } from 'lucide-react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { PROJECT_STATUS_COLORS, PROJECT_STATUS_LABELS, PROJECT_TYPE_COLORS, PROJECT_TYPE_LABELS, ROLE_LABELS, formatCurrency, formatDate } from '@/lib/utils'

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
  assignments?: { user: { id: string; name: string; avatar?: string } }[]
}

interface Client { id: string; name: string; company?: string }

const IN_PROGRESS_STATUSES = ['BRIEF', 'REDACTION', 'MAQUETTE', 'DEVELOPPEMENT', 'INTEGRATION', 'OPTIMISATIONS', 'TESTING', 'CONCEPTION', 'REVIEW']
const DONE_STATUSES = ['LIVRAISON', 'MAINTENANCE', 'ARCHIVE']
const PRESTATIONS = ['Site web', 'Web app', 'Branding']

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
  })
  const [createStep, setCreateStep] = useState<1 | 2>(1)
  const [cdc, setCdc] = useState<CdcData>({ siteType: 'VITRINE', isRefonte: false, fonctionnalites: [] })
  const [brandingCdc, setBrandingCdc] = useState<BrandingCdcData>({})
  const [prospectHasCdc, setProspectHasCdc] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [showClientDropdown, setShowClientDropdown] = useState(false)

  const [deleteModal, setDeleteModal] = useState<{ project: Project; step: 1 | 2 } | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

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
        body: JSON.stringify({ ...projectData, price: null, deadline: null }),
      })
      if (!res.ok) {
        const err = await res.json()
        setCreateError(err.error || 'Erreur lors de la création')
        return
      }
      const project = await res.json()
      // Assign team members with individual price/deadline (days → ISO date)
      await Promise.all(
        assignees.map(a => {
          let deadlineDate: string | null = null
          if (a.deadline) {
            const days = parseInt(a.deadline)
            if (!isNaN(days) && days > 0) {
              const d = new Date()
              d.setDate(d.getDate() + days)
              deadlineDate = d.toISOString()
            }
          }
          return fetch(`/api/projects/${project.id}/assignees`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: a.userId,
              price: a.price ? parseFloat(a.price) : null,
              deadline: deadlineDate,
            }),
          })
        })
      )
      // Save CDC data via ClientForm
      try {
        const formRes = await fetch(`/api/projects/${project.id}/form`)
        const formData = await formRes.json()
        await fetch(`/api/formulaire/${formData.token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cdcData: form.services[0] === 'Branding' ? brandingCdc : cdc }),
        })
      } catch { /* ignore */ }
      setProjects(prev => [project, ...prev])
      setShowModal(false)
      setCreateStep(1)
      setForm({ name: '', clientId: '', type: 'WORDPRESS', status: 'BRIEF', services: [], assignees: [] })
      setCdc({ siteType: 'VITRINE', isRefonte: false, fonctionnalites: [] })
      setBrandingCdc({})
      setProspectHasCdc(false)
      setClientSearch('')
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

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Projets</h1>
          <p className="text-slate-400 text-sm mt-1">{filtered.length} projet{filtered.length > 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
          <Plus size={16} /> Nouveau projet
        </button>
      </div>

      {/* Tabs En cours / Terminés + search + statut */}
      <div className="flex gap-3 mb-6 flex-wrap">
        {/* Vue toggle */}
        <div className="flex items-center bg-[#111118] border border-slate-800 rounded-xl p-1">
          <button onClick={() => setFilterStatus('EN_COURS')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${!isTerminesView ? 'bg-[#E14B89] text-white' : 'text-slate-400 hover:text-white'}`}>
            En cours <span className="ml-1 opacity-70">{inProgressCount}</span>
          </button>
          <button onClick={() => setFilterStatus('TERMINES')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${isTerminesView ? 'bg-[#E14B89] text-white' : 'text-slate-400 hover:text-white'}`}>
            Terminés <span className="ml-1 opacity-70">{doneCount}</span>
          </button>
        </div>

        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
            className="bg-[#111118] border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#E14B89] transition-colors w-52" />
        </div>

        {/* Filtre par statut précis */}
        <div className="flex items-center gap-1 bg-[#111118] border border-slate-800 rounded-xl p-1 flex-wrap">
          {isTerminesView ? (
            <>
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
            </>
          ) : (
            <>
              <button onClick={() => setFilterStatus('EN_COURS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === 'EN_COURS' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
                Tous
              </button>
              {IN_PROGRESS_STATUSES.map(s => (
                <button key={s} onClick={() => setFilterStatus(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === s ? 'bg-[#E14B89] text-white' : 'text-slate-400 hover:text-white'}`}>
                  {PROJECT_STATUS_LABELS[s]}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-6 bg-[#111118] border border-slate-800 rounded-2xl p-5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-4 bg-slate-800 rounded-full w-40" />
                  <div className="h-5 bg-slate-800 rounded-full w-20" />
                </div>
                <div className="h-3 bg-slate-800 rounded-full w-28" />
              </div>
              <div className="flex items-center gap-6 flex-shrink-0">
                <div className="w-24">
                  <div className="h-1.5 bg-slate-800 rounded-full" />
                </div>
                <div className="h-3 bg-slate-800 rounded-full w-20" />
                <div className="h-3 bg-slate-800 rounded-full w-16" />
                <div className="h-6 bg-slate-800 rounded-full w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(project => {
            const progress = taskProgress(project.tasks)
            return (
              <div key={project.id} className="flex items-center gap-0 group">
                <Link href={`/projects/${project.id}`}
                  className="flex-1 flex items-center bg-[#111118] border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors min-w-0">
                  {/* Gauche : nom + client */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-white font-medium group-hover:text-[#F8903C] transition-colors">{project.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PROJECT_TYPE_COLORS[project.type]}`}>
                        {PROJECT_TYPE_LABELS[project.type]}
                      </span>
                    </div>
                    <p className="text-slate-400 text-sm">{project.client.name}{project.client.company ? ` · ${project.client.company}` : ''}</p>
                  </div>
                  {/* Centre : freelances */}
                  {project.assignments && project.assignments.length > 0 && (
                    <div className="flex -space-x-1.5 mx-6 flex-shrink-0">
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
                      {project.assignments.length > 5 && (
                        <div className="w-6 h-6 rounded-full border-2 border-[#111118] bg-slate-700 flex items-center justify-center text-[8px] text-slate-300">
                          +{project.assignments.length - 5}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Droite : tâches + deadline + prix + statut */}
                  <div className="flex items-center gap-5 flex-shrink-0">
                    {project.tasks.length > 0 && (
                      <div className="w-24">
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                          <span>Tâches</span><span>{progress}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-800 rounded-full">
                          <div className="h-full bg-[#E14B89] rounded-full" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    )}
                    {project.deadline && <span className="text-slate-400 text-sm">{formatDate(project.deadline)}</span>}
                    {project.price && <span className="text-white font-medium text-sm">{formatCurrency(project.price)}</span>}
                    <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${PROJECT_STATUS_COLORS[project.status]}`}>
                      {PROJECT_STATUS_LABELS[project.status]}
                    </span>
                  </div>
                </Link>
                {isAdmin && (
                  <button
                    onClick={() => openDeleteModal(project)}
                    className="ml-2 opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all p-2 rounded-lg hover:bg-red-400/10 flex-shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            )
          })}
          {filtered.length === 0 && <div className="text-center py-16 text-slate-500">Aucun projet</div>}
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
              <div className={`flex items-center gap-2 text-sm font-medium ${createStep === 1 ? 'text-white' : 'text-slate-500'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${createStep === 1 ? 'bg-[#E14B89] text-white' : 'bg-slate-700 text-slate-400'}`}>1</div>
                Projet
              </div>
              <div className="flex-1 h-px bg-slate-700" />
              <div className={`flex items-center gap-2 text-sm font-medium ${createStep === 2 ? 'text-white' : 'text-slate-500'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${createStep === 2 ? 'bg-[#E14B89] text-white' : 'bg-slate-700 text-slate-400'}`}>2</div>
                Mission & CDC
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
                                    <p className="text-slate-600 text-[9px] mt-0.5">→ {new Date(Date.now() + parseInt(entry.deadline) * 86400000).toLocaleDateString('fr-FR')}</p>
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
                    Cahier des charges pré-rempli depuis le prospect. Vérifiez et validez.
                  </div>
                )}

                {!form.services[0] ? (
                  <p className="text-slate-500 text-xs py-2">Sélectionnez un type de mission pour afficher le cahier des charges</p>
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
          </div>
        </div>
      )}
    </div>
  )
}
