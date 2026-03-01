'use client'

import { useEffect, useState } from 'react'
import { Plus, Search, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { PROJECT_STATUS_COLORS, PROJECT_STATUS_LABELS, PROJECT_TYPE_COLORS, PROJECT_TYPE_LABELS, formatCurrency, formatDate } from '@/lib/utils'

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
}

interface Client { id: string; name: string }

const STATUS_ORDER = ['BRIEF', 'REDACTION', 'MAQUETTE', 'DEVELOPPEMENT', 'REVIEW', 'LIVRAISON', 'MAINTENANCE']
const IN_PROGRESS_STATUSES = ['BRIEF', 'REDACTION', 'MAQUETTE', 'DEVELOPPEMENT', 'REVIEW']
const DONE_STATUSES = ['LIVRAISON', 'MAINTENANCE', 'ARCHIVE']
const SERVICES = ['SEO', 'Google Ads', 'Meta Ads', 'Réseaux sociaux', 'Identité visuelle', 'Google Business', 'Rédaction', 'Maintenance']

export default function ProjectsPage() {
  const { data: session } = useSession()
  const isAdmin = (session?.user as { role?: string })?.role === 'ADMIN'

  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('EN_COURS')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [createError, setCreateError] = useState('')
  const [form, setForm] = useState({
    name: '', clientId: '', type: 'WORDPRESS', status: 'BRIEF',
    price: '', deadline: '', notes: '', services: [] as string[],
  })

  const [deleteModal, setDeleteModal] = useState<{ project: Project; step: 1 | 2 } | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/projects').then(r => r.json()),
      fetch('/api/clients').then(r => r.json()),
    ]).then(([p, c]) => { setProjects(p); setClients(c) }).finally(() => setLoading(false))
  }, [])

  const filtered = projects.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.client.name.toLowerCase().includes(search.toLowerCase())
    if (filterStatus === 'EN_COURS') return matchSearch && IN_PROGRESS_STATUSES.includes(p.status)
    if (filterStatus === 'TERMINES') return matchSearch && DONE_STATUSES.includes(p.status)
    return matchSearch && p.status === filterStatus
  })

  const inProgressCount = projects.filter(p => IN_PROGRESS_STATUSES.includes(p.status)).length
  const doneCount = projects.filter(p => DONE_STATUSES.includes(p.status)).length

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setCreateError('')
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, price: form.price ? parseFloat(form.price) : null, deadline: form.deadline || null }),
      })
      if (!res.ok) {
        const err = await res.json()
        setCreateError(err.error || 'Erreur lors de la création')
        return
      }
      const project = await res.json()
      setProjects(prev => [project, ...prev])
      setShowModal(false)
      setForm({ name: '', clientId: '', type: 'WORDPRESS', status: 'BRIEF', price: '', deadline: '', notes: '', services: [] })
    } finally {
      setSubmitting(false)
    }
  }

  function toggleService(s: string) {
    setForm(f => ({ ...f, services: f.services.includes(s) ? f.services.filter(x => x !== s) : [...f.services, s] }))
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
      await fetch(`/api/projects/${deleteModal.project.id}`, { method: 'DELETE' })
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
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filterStatus === 'EN_COURS' ? 'bg-[#E14B89] text-white' : 'text-slate-400 hover:text-white'}`}>
            En cours <span className="ml-1 opacity-70">{inProgressCount}</span>
          </button>
          <button onClick={() => setFilterStatus('TERMINES')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filterStatus === 'TERMINES' ? 'bg-[#E14B89] text-white' : 'text-slate-400 hover:text-white'}`}>
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
          <button onClick={() => setFilterStatus('EN_COURS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === 'EN_COURS' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
            Tous
          </button>
          {(filterStatus === 'TERMINES' ? DONE_STATUSES : IN_PROGRESS_STATUSES).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === s ? 'bg-[#E14B89] text-white' : 'text-slate-400 hover:text-white'}`}>
              {PROJECT_STATUS_LABELS[s]}
            </button>
          ))}
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
              <div key={project.id} className="relative group">
                <Link href={`/projects/${project.id}`}
                  className="flex items-center gap-6 bg-[#111118] border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-white font-medium group-hover:text-[#F8903C] transition-colors">{project.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PROJECT_TYPE_COLORS[project.type]}`}>
                        {PROJECT_TYPE_LABELS[project.type]}
                      </span>
                    </div>
                    <p className="text-slate-400 text-sm">{project.client.name}{project.client.company ? ` · ${project.client.company}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-6 flex-shrink-0">
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
                    className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all p-1.5 rounded-lg hover:bg-red-400/10"
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
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-white font-semibold text-lg mb-5">Nouveau projet</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Nom du projet *</label>
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Client *</label>
                <select required value={form.clientId} onChange={e => setForm({ ...form, clientId: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                  <option value="">Sélectionner un client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-slate-400 text-xs mb-1.5">Type</label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                    <option value="WORDPRESS">WordPress</option>
                    <option value="FRAMER">Framer</option>
                    <option value="CUSTOM">Sur mesure</option>
                    <option value="ECOMMERCE">E-commerce</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Prix (€)</label>
                  <input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Deadline</label>
                  <input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                </div>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-2">Services inclus</label>
                <div className="flex flex-wrap gap-2">
                  {SERVICES.map(s => (
                    <button key={s} type="button" onClick={() => toggleService(s)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${form.services.includes(s) ? 'bg-[#E14B89]/20 border-[#E14B89] text-[#F8903C]' : 'border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none" />
              </div>

              {/* Error message */}
              {createError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
                  {createError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors">Annuler</button>
                <button type="submit" disabled={submitting}
                  className="flex-1 bg-[#E14B89] hover:opacity-90 text-white py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-60">
                  {submitting ? 'Création...' : 'Créer le projet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
