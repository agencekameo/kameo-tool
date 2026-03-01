'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Trash2, CheckCircle2, Circle, Save, Pencil, ExternalLink,
  FileText, X, Globe, Figma, Upload, ChevronDown, ChevronRight,
  FileCheck, Info, Palette, Scale, FolderOpen, Link2, Maximize2,
} from 'lucide-react'
import {
  PROJECT_STATUS_COLORS, PROJECT_STATUS_LABELS, PROJECT_TYPE_COLORS, PROJECT_TYPE_LABELS,
  TASK_PRIORITY_COLORS, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS,
  ROLE_AVATAR_COLORS, ROLE_LABELS,
  formatCurrency, formatDate,
} from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Task {
  id: string; title: string; description?: string; status: string; priority: string
  dueDate?: string; assignee?: { id: string; name: string }
}
interface Invoice {
  id: string; filename: string; fileUrl: string; amount?: number; notes?: string
  createdAt: string; uploader: { id: string; name: string }
}
interface ProjectUser {
  id: string; name: string; role: string; avatar?: string
}
interface ProjectDoc {
  id: string; name: string; url: string; category: string
  createdAt: string; uploadedBy: { id: string; name: string }
}
interface Project {
  id: string; name: string; type: string; status: string; price?: number
  deadline?: string; startDate?: string; services: string[]; notes?: string
  figmaUrl?: string | null; contentUrl?: string | null
  client: { id: string; name: string; company?: string; website?: string }
  tasks: Task[]; createdBy: { id: string; name: string }
  assignees: ProjectUser[]; documents: ProjectDoc[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_ORDER = ['BRIEF', 'REDACTION', 'MAQUETTE', 'DEVELOPPEMENT', 'REVIEW', 'LIVRAISON', 'MAINTENANCE', 'ARCHIVE']

const DOC_CATEGORIES = [
  { key: 'CAHIER_DES_CHARGES', label: 'Cahier des charges', icon: FileCheck, color: 'text-violet-400' },
  { key: 'INFO_PROJET',        label: 'Informations projet', icon: Info,       color: 'text-blue-400' },
  { key: 'CHARTE_GRAPHIQUE',   label: 'Charte graphique',   icon: Palette,    color: 'text-pink-400' },
  { key: 'DOCUMENT_LEGAL',     label: 'Documents légaux',   icon: Scale,      color: 'text-amber-400' },
  { key: 'AUTRE',              label: 'Autres',              icon: FolderOpen, color: 'text-slate-400' },
]

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const [project, setProject] = useState<Project | null>(null)
  const [users, setUsers] = useState<ProjectUser[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<Project & { price: string; deadline: string }>>({})
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [showDocModal, setShowDocModal] = useState(false)
  const [taskForm, setTaskForm] = useState({ title: '', priority: 'MEDIUM', assigneeId: '', dueDate: '', description: '' })
  const [invoiceForm, setInvoiceForm] = useState({ filename: '', fileUrl: '', amount: '', notes: '' })
  const [docForm, setDocForm] = useState({ name: '', url: '', category: 'CAHIER_DES_CHARGES' })
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({})
  const [figmaExpanded, setFigmaExpanded] = useState(false)
  const [editingFigma, setEditingFigma] = useState(false)
  const [editingContent, setEditingContent] = useState(false)
  const [figmaInput, setFigmaInput] = useState('')
  const [contentInput, setContentInput] = useState('')

  const isAdmin = (session?.user as { role?: string })?.role === 'ADMIN'
  const userRole = (session?.user as { role?: string })?.role ?? ''

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${id}`).then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
      fetch(`/api/projects/${id}/invoices`).then(r => r.json()),
    ]).then(([p, u, inv]) => {
      setProject(p)
      setForm({ ...p, price: p.price?.toString() ?? '', deadline: p.deadline ? p.deadline.split('T')[0] : '' })
      setUsers(u)
      setInvoices(inv)
      setFigmaInput(p.figmaUrl ?? '')
      setContentInput(p.contentUrl ?? '')
    })
  }, [id])

  // ── Status auto-save (direct click on pipeline) ──────────────────────────
  async function handleStatusClick(newStatus: string) {
    if (!project || project.status === newStatus) return
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

  // ── Details save ────────────────────────────────────────────────────────────
  async function handleSave() {
    const res = await fetch(`/api/projects/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        price: form.price ? parseFloat(form.price as string) : null,
        deadline: (form.deadline as string) || null,
      }),
    })
    const updated = await res.json()
    setProject(p => p ? { ...p, ...updated } : p)
    setEditing(false)
  }

  async function handleDelete() {
    if (!confirm('Supprimer ce projet ?')) return
    await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    router.push('/projects')
  }

  // ── Figma URL ────────────────────────────────────────────────────────────────
  async function saveFigmaUrl() {
    await fetch(`/api/projects/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ figmaUrl: figmaInput }),
    })
    setProject(p => p ? { ...p, figmaUrl: figmaInput || null } : p)
    setEditingFigma(false)
  }

  // ── Content URL ──────────────────────────────────────────────────────────────
  async function saveContentUrl() {
    await fetch(`/api/projects/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentUrl: contentInput }),
    })
    setProject(p => p ? { ...p, contentUrl: contentInput || null } : p)
    setEditingContent(false)
  }

  // ── Tasks ────────────────────────────────────────────────────────────────────
  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...taskForm, projectId: id, assigneeId: taskForm.assigneeId || null, dueDate: taskForm.dueDate || null }),
    })
    const task = await res.json()
    setProject(prev => prev ? { ...prev, tasks: [task, ...prev.tasks] } : prev)
    setShowTaskModal(false)
    setTaskForm({ title: '', priority: 'MEDIUM', assigneeId: '', dueDate: '', description: '' })
  }

  async function toggleTaskStatus(task: Task) {
    const newStatus = task.status === 'DONE' ? 'TODO' : 'DONE'
    await fetch(`/api/tasks/${task.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) })
    setProject(prev => prev ? { ...prev, tasks: prev.tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t) } : prev)
  }

  async function deleteTask(taskId: string) {
    await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
    setProject(prev => prev ? { ...prev, tasks: prev.tasks.filter(t => t.id !== taskId) } : prev)
  }

  // ── Assignees ─────────────────────────────────────────────────────────────────
  async function handleAddAssignee(userId: string) {
    await fetch(`/api/projects/${id}/assignees`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }),
    })
    const user = users.find(u => u.id === userId)
    if (user) setProject(prev => prev ? { ...prev, assignees: [...prev.assignees, user] } : prev)
  }

  async function handleRemoveAssignee(userId: string) {
    await fetch(`/api/projects/${id}/assignees`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }),
    })
    setProject(prev => prev ? { ...prev, assignees: prev.assignees.filter(a => a.id !== userId) } : prev)
  }

  // ── Invoices ──────────────────────────────────────────────────────────────────
  async function handleCreateInvoice(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch(`/api/projects/${id}/invoices`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...invoiceForm, amount: invoiceForm.amount ? parseFloat(invoiceForm.amount) : null }),
    })
    const invoice = await res.json()
    setInvoices(prev => [invoice, ...prev])
    setShowInvoiceModal(false)
    setInvoiceForm({ filename: '', fileUrl: '', amount: '', notes: '' })
  }

  // ── Documents ─────────────────────────────────────────────────────────────────
  async function handleCreateDoc(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch(`/api/projects/${id}/documents`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(docForm),
    })
    const doc = await res.json()
    setProject(prev => prev ? { ...prev, documents: [doc, ...prev.documents] } : prev)
    setShowDocModal(false)
    setDocForm({ name: '', url: '', category: 'CAHIER_DES_CHARGES' })
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

  // ── Loading skeleton ──────────────────────────────────────────────────────────
  if (!project) return (
    <div className="p-4 sm:p-8 max-w-5xl animate-pulse">
      <div className="h-4 bg-slate-800 rounded-full w-36 mb-6" />
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-7 bg-slate-800 rounded-full w-56" />
            <div className="h-6 bg-slate-800 rounded-full w-24" />
          </div>
          <div className="h-4 bg-slate-800 rounded-full w-40" />
        </div>
        <div className="h-9 bg-slate-800 rounded-xl w-32" />
      </div>
      <div className="h-12 bg-slate-800 rounded-2xl mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-slate-800/50 rounded-2xl" />)}
        </div>
        <div className="space-y-4">
          {[1, 2].map(i => <div key={i} className="h-40 bg-slate-800/50 rounded-2xl" />)}
        </div>
      </div>
    </div>
  )

  const doneTasks = project.tasks.filter(t => t.status === 'DONE').length
  const progress = project.tasks.length ? Math.round((doneTasks / project.tasks.length) * 100) : 0
  const unassignedUsers = users.filter(u => !project.assignees.find(a => a.id === u.id))

  // Figma embed URL
  const getFigmaEmbedUrl = (url: string) =>
    `https://www.figma.com/embed?embed_host=kameo&url=${encodeURIComponent(url)}`

  const canEditContent = isAdmin || userRole === 'REDACTEUR'
  const canEditFigma = isAdmin || userRole === 'DESIGNER'

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      {/* Back */}
      <Link href="/projects" className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6 transition-colors">
        <ArrowLeft size={16} /> Retour aux projets
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="text-2xl font-semibold text-white">{project.name}</h1>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${PROJECT_TYPE_COLORS[project.type]}`}>
              {PROJECT_TYPE_LABELS[project.type]}
            </span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Link href={`/clients/${project.client.id}`} className="text-slate-400 hover:text-[#E14B89] transition-colors text-sm">
              {project.client.name}{project.client.company ? ` · ${project.client.company}` : ''}
            </Link>
            {/* Site client — prominent button */}
            {project.client.website && (
              <a
                href={project.client.website.startsWith('http') ? project.client.website : `https://${project.client.website}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
              >
                <Globe size={12} className="text-[#E14B89]" />
                Voir le site client
                <ExternalLink size={10} className="text-slate-500" />
              </a>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {editing ? (
            <>
              <button onClick={handleSave} className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 text-white px-4 py-2 rounded-xl text-sm transition-colors">
                <Save size={14} /> Sauvegarder
              </button>
              <button onClick={() => setEditing(false)} className="border border-slate-700 text-slate-400 hover:text-white p-2 rounded-xl text-sm transition-colors">
                <X size={14} />
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="flex items-center gap-2 border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-white px-4 py-2 rounded-xl text-sm transition-colors">
              <Pencil size={14} /> Modifier
            </button>
          )}
          {isAdmin && (
            <button onClick={handleDelete} className="border border-red-900/40 hover:border-red-700 text-red-500 hover:text-red-400 p-2 rounded-xl text-sm transition-colors">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Status pipeline — always clickable */}
      <div className="bg-[#111118] border border-slate-800 rounded-2xl p-4 mb-6">
        <div className="flex items-center gap-1">
          {STATUS_ORDER.filter(s => s !== 'ARCHIVE').map((s, i) => {
            const currentIdx = STATUS_ORDER.indexOf(project.status)
            const sIdx = STATUS_ORDER.indexOf(s)
            const isActive = s === project.status
            const isDone = sIdx < currentIdx
            return (
              <div key={s} className="flex items-center flex-1">
                <button
                  onClick={() => handleStatusClick(s)}
                  className={`flex-1 text-center py-2 px-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#E14B89] text-white shadow-lg shadow-[#E14B89]/20'
                      : isDone
                      ? 'bg-[#E14B89]/20 text-[#E14B89] hover:bg-[#E14B89]/30'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {PROJECT_STATUS_LABELS[s]}
                </button>
                {i < STATUS_ORDER.filter(s => s !== 'ARCHIVE').length - 1 && (
                  <div className={`h-px w-2 mx-0.5 ${isDone ? 'bg-[#E14B89]/50' : 'bg-slate-700'}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── Left column ─────────────────────────────────────────────────── */}
        <div className="col-span-2 space-y-4">

          {/* Maquettes Figma */}
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Figma size={16} className="text-[#E14B89]" />
                <h2 className="text-white font-medium">Maquettes Figma</h2>
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
                <button onClick={saveFigmaUrl} className="bg-[#E14B89] hover:opacity-90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
                  <Save size={14} />
                </button>
                <button onClick={() => setEditingFigma(false)} className="border border-slate-700 text-slate-400 hover:text-white px-3 py-2 rounded-xl text-sm transition-colors">
                  <X size={14} />
                </button>
              </div>
            ) : project.figmaUrl ? (
              <div className="space-y-3">
                {/* Figma preview iframe */}
                {figmaExpanded && (
                  <div className="relative rounded-xl overflow-hidden border border-slate-700" style={{ height: 480 }}>
                    <iframe
                      src={getFigmaEmbedUrl(project.figmaUrl)}
                      className="w-full h-full"
                      allowFullScreen
                    />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <a
                    href={project.figmaUrl}
                    target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center gap-2 bg-[#1a1a2e] border border-[#E14B89]/20 hover:border-[#E14B89]/50 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                  >
                    <Figma size={15} className="text-[#E14B89] flex-shrink-0" />
                    <span className="truncate">{project.figmaUrl}</span>
                    <ExternalLink size={12} className="text-slate-500 flex-shrink-0 ml-auto" />
                  </a>
                  <button
                    onClick={() => setFigmaExpanded(!figmaExpanded)}
                    title={figmaExpanded ? 'Réduire' : 'Aperçu intégré'}
                    className="flex items-center gap-1.5 border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white px-3 py-2.5 rounded-xl text-xs transition-colors flex-shrink-0"
                  >
                    <Maximize2 size={13} />
                    {figmaExpanded ? 'Réduire' : 'Aperçu'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">
                {canEditFigma ? 'Aucune maquette — cliquez sur ✏️ pour ajouter un lien Figma.' : 'Aucune maquette disponible pour l\'instant.'}
              </p>
            )}
          </div>

          {/* Contenu rédactionnel */}
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileCheck size={16} className="text-teal-400" />
                <h2 className="text-white font-medium">Contenu rédactionnel</h2>
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
                <button onClick={saveContentUrl} className="bg-[#E14B89] hover:opacity-90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
                  <Save size={14} />
                </button>
                <button onClick={() => setEditingContent(false)} className="border border-slate-700 text-slate-400 hover:text-white px-3 py-2 rounded-xl text-sm transition-colors">
                  <X size={14} />
                </button>
              </div>
            ) : project.contentUrl ? (
              <a
                href={project.contentUrl}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 bg-teal-500/5 border border-teal-500/20 hover:border-teal-500/40 text-white px-4 py-3 rounded-xl text-sm font-medium transition-colors"
              >
                <FileCheck size={16} className="text-teal-400 flex-shrink-0" />
                <span className="truncate flex-1">{project.contentUrl}</span>
                <ExternalLink size={12} className="text-slate-500 flex-shrink-0" />
              </a>
            ) : (
              <p className="text-slate-500 text-sm">
                {canEditContent ? 'Aucun contenu — cliquez sur ✏️ pour ajouter un lien (Google Docs, Notion…).' : 'Contenu pas encore disponible.'}
              </p>
            )}
          </div>

          {/* Documents */}
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Upload size={16} className="text-slate-400" />
                <h2 className="text-white font-medium">Documents</h2>
                <span className="text-slate-600 text-xs">({project.documents.length})</span>
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
                const docs = project.documents.filter(d => d.category === cat.key)
                const isExpanded = expandedCats[cat.key] !== false // default expanded
                const CatIcon = cat.icon
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
                      <span className="text-slate-600 text-xs mr-1">{docs.length}</span>
                      {isExpanded
                        ? <ChevronDown size={13} className="text-slate-600" />
                        : <ChevronRight size={13} className="text-slate-600" />}
                    </button>

                    {isExpanded && (
                      <div className="ml-6 mb-1 space-y-1">
                        {docs.length === 0 ? (
                          <p className="text-slate-600 text-xs py-1 italic">Aucun document</p>
                        ) : docs.map(doc => (
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
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Tâches */}
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-white font-medium">Tâches</h2>
                {project.tasks.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-slate-800 rounded-full">
                      <div className="h-full bg-[#E14B89] rounded-full" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="text-slate-400 text-xs">{doneTasks}/{project.tasks.length}</span>
                  </div>
                )}
              </div>
              <button onClick={() => setShowTaskModal(true)}
                className="flex items-center gap-1.5 text-[#E14B89] hover:text-[#F8903C] text-sm transition-colors">
                <Plus size={15} /> Ajouter
              </button>
            </div>
            <div className="space-y-2">
              {project.tasks.length === 0 && <p className="text-slate-500 text-sm">Aucune tâche</p>}
              {project.tasks.map(task => (
                <div key={task.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-800/30 group">
                  <button onClick={() => toggleTaskStatus(task)} className="mt-0.5 flex-shrink-0">
                    {task.status === 'DONE'
                      ? <CheckCircle2 size={16} className="text-green-400" />
                      : <Circle size={16} className="text-slate-600 hover:text-[#E14B89] transition-colors" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${task.status === 'DONE' ? 'line-through text-slate-500' : 'text-white'}`}>{task.title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${TASK_PRIORITY_COLORS[task.priority]}`}>
                        {TASK_PRIORITY_LABELS[task.priority]}
                      </span>
                      <span className="text-slate-500 text-xs">{TASK_STATUS_LABELS[task.status]}</span>
                      {task.assignee && <span className="text-slate-500 text-xs">· {task.assignee.name}</span>}
                      {task.dueDate && <span className="text-slate-500 text-xs">· {formatDate(task.dueDate)}</span>}
                    </div>
                  </div>
                  <button onClick={() => deleteTask(task.id)} className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all flex-shrink-0">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Factures */}
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-medium">Factures</h2>
              {isAdmin && (
                <button onClick={() => setShowInvoiceModal(true)}
                  className="flex items-center gap-1.5 text-[#E14B89] hover:text-[#F8903C] text-sm transition-colors">
                  <Plus size={15} /> Ajouter
                </button>
              )}
            </div>
            {invoices.length === 0 ? (
              <p className="text-slate-500 text-sm">Aucune facture</p>
            ) : (
              <div className="space-y-2">
                {invoices.map(inv => (
                  <div key={inv.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800/30">
                    <FileText size={16} className="text-slate-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <a href={inv.fileUrl} target="_blank" rel="noopener noreferrer"
                        className="text-white text-sm hover:text-[#E14B89] transition-colors flex items-center gap-1">
                        {inv.filename}
                        <ExternalLink size={11} className="text-slate-500" />
                      </a>
                      <p className="text-slate-500 text-xs mt-0.5">
                        Par {inv.uploader.name} · {formatDate(inv.createdAt)}
                        {inv.amount && isAdmin ? ` · ${formatCurrency(inv.amount)}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─── Right sidebar ────────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Details */}
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
            <h2 className="text-white font-medium mb-4">Détails</h2>
            {editing ? (
              <div className="space-y-3">
                {isAdmin && (
                  <div>
                    <label className="block text-slate-400 text-xs mb-1">Prix (€)</label>
                    <input type="number" value={(form.price as unknown as string) ?? ''} onChange={e => setForm({ ...form, price: e.target.value as unknown as undefined })}
                      className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                  </div>
                )}
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Deadline</label>
                  <input type="date" value={form.deadline as string ?? ''} onChange={e => setForm({ ...form, deadline: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Notes</label>
                  <textarea value={form.notes ?? ''} rows={4} onChange={e => setForm({ ...form, notes: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none" />
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                {/* Price — admin only */}
                {isAdmin && project.price != null && (
                  <div>
                    <p className="text-slate-400 text-xs">Prix</p>
                    <p className="text-white font-medium">{formatCurrency(project.price)}</p>
                  </div>
                )}
                {project.deadline && (
                  <div>
                    <p className="text-slate-400 text-xs">Deadline</p>
                    <p className="text-white">{formatDate(project.deadline)}</p>
                  </div>
                )}
                {project.services.length > 0 && (
                  <div>
                    <p className="text-slate-400 text-xs mb-1.5">Services</p>
                    <div className="flex flex-wrap gap-1">
                      {project.services.map(s => (
                        <span key={s} className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {project.notes && (
                  <div>
                    <p className="text-slate-400 text-xs">Notes</p>
                    <p className="text-slate-300 text-sm whitespace-pre-wrap mt-1">{project.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Équipe */}
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
            <h2 className="text-white font-medium mb-3">Équipe</h2>
            <div className="space-y-2 mb-3">
              {project.assignees.length === 0 && <p className="text-slate-500 text-xs">Aucun membre assigné</p>}
              {project.assignees.map(a => {
                const gradient = ROLE_AVATAR_COLORS[a.role] ?? 'from-slate-400 to-slate-600'
                return (
                  <div key={a.id} className="flex items-center gap-2.5 group">
                    <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}>
                      <span className="text-white text-xs font-semibold">{a.name[0]?.toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-medium truncate">{a.name}</p>
                      <p className="text-slate-500 text-xs">{ROLE_LABELS[a.role] ?? a.role}</p>
                    </div>
                    {isAdmin && (
                      <button onClick={() => handleRemoveAssignee(a.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all">
                        <X size={13} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            {isAdmin && unassignedUsers.length > 0 && (
              <div>
                <p className="text-slate-500 text-xs mb-2">Ajouter un membre</p>
                <select onChange={e => { if (e.target.value) { handleAddAssignee(e.target.value); e.target.value = '' } }}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2 text-slate-400 text-xs focus:outline-none focus:border-[#E14B89] transition-colors">
                  <option value="">Sélectionner...</option>
                  {unassignedUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
            <p className="text-slate-400 text-xs">Créé par</p>
            <p className="text-white text-sm mt-1">{project.createdBy.name}</p>
          </div>
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────────── */}

      {/* Task modal */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-white font-semibold text-lg mb-5">Nouvelle tâche</h2>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Titre *</label>
                <input required value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Priorité</label>
                  <select value={taskForm.priority} onChange={e => setTaskForm({ ...taskForm, priority: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                    <option value="LOW">Faible</option>
                    <option value="MEDIUM">Normale</option>
                    <option value="HIGH">Haute</option>
                    <option value="CRITICAL">Critique</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Assigné à</label>
                  <select value={taskForm.assigneeId} onChange={e => setTaskForm({ ...taskForm, assigneeId: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                    <option value="">Non assigné</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Échéance</label>
                <input type="date" value={taskForm.dueDate} onChange={e => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Description</label>
                <textarea value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} rows={3}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowTaskModal(false)}
                  className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors">Annuler</button>
                <button type="submit" className="flex-1 bg-[#E14B89] hover:opacity-90 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">Créer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document modal */}
      {showDocModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-white font-semibold text-lg mb-5">Ajouter un document</h2>
            <form onSubmit={handleCreateDoc} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Nom du document *</label>
                <input required value={docForm.name} onChange={e => setDocForm({ ...docForm, name: e.target.value })}
                  placeholder="Ex : Charte graphique v2"
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Catégorie</label>
                <select value={docForm.category} onChange={e => setDocForm({ ...docForm, category: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                  {DOC_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Lien (Drive, Notion, PDF…) *</label>
                <input required value={docForm.url} onChange={e => setDocForm({ ...docForm, url: e.target.value })}
                  placeholder="https://drive.google.com/..."
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowDocModal(false)}
                  className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors">Annuler</button>
                <button type="submit" className="flex-1 bg-[#E14B89] hover:opacity-90 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">Ajouter</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice modal */}
      {showInvoiceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-white font-semibold text-lg mb-5">Ajouter une facture</h2>
            <form onSubmit={handleCreateInvoice} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Nom du fichier *</label>
                <input required value={invoiceForm.filename} onChange={e => setInvoiceForm({ ...invoiceForm, filename: e.target.value })}
                  placeholder="Facture-2024-01.pdf"
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Lien Google Drive *</label>
                <input required value={invoiceForm.fileUrl} onChange={e => setInvoiceForm({ ...invoiceForm, fileUrl: e.target.value })}
                  placeholder="https://drive.google.com/..."
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Montant (€)</label>
                <input type="number" step="0.01" value={invoiceForm.amount} onChange={e => setInvoiceForm({ ...invoiceForm, amount: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Notes</label>
                <input value={invoiceForm.notes} onChange={e => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowInvoiceModal(false)}
                  className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors">Annuler</button>
                <button type="submit" className="flex-1 bg-[#E14B89] hover:opacity-90 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">Ajouter</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
