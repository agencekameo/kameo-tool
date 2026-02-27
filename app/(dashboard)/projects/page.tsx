'use client'

import { useEffect, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import Link from 'next/link'
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

const STATUS_ORDER = ['BRIEF', 'MAQUETTE', 'DEVELOPPEMENT', 'REVIEW', 'LIVRAISON', 'MAINTENANCE']
const SERVICES = ['SEO', 'Google Ads', 'Meta Ads', 'Réseaux sociaux', 'Identité visuelle', 'Google Business', 'Rédaction', 'Maintenance']

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    name: '', clientId: '', type: 'WORDPRESS', status: 'BRIEF',
    price: '', deadline: '', notes: '', services: [] as string[],
  })

  useEffect(() => {
    Promise.all([
      fetch('/api/projects').then(r => r.json()),
      fetch('/api/clients').then(r => r.json()),
    ]).then(([p, c]) => { setProjects(p); setClients(c) }).finally(() => setLoading(false))
  }, [])

  const filtered = projects.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.client.name.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'ALL' || p.status === filterStatus
    return matchSearch && matchStatus
  })

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, price: form.price ? parseFloat(form.price) : null, deadline: form.deadline || null }),
    })
    const project = await res.json()
    setProjects(prev => [project, ...prev])
    setShowModal(false)
    setForm({ name: '', clientId: '', type: 'WORDPRESS', status: 'BRIEF', price: '', deadline: '', notes: '', services: [] })
  }

  function toggleService(s: string) {
    setForm(f => ({ ...f, services: f.services.includes(s) ? f.services.filter(x => x !== s) : [...f.services, s] }))
  }

  const taskProgress = (tasks: { status: string }[]) => {
    if (!tasks.length) return 0
    return Math.round((tasks.filter(t => t.status === 'DONE').length / tasks.length) * 100)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Projets</h1>
          <p className="text-slate-400 text-sm mt-1">{filtered.length} projet{filtered.length > 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
          <Plus size={16} /> Nouveau projet
        </button>
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
            className="bg-[#111118] border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-violet-500 transition-colors w-56" />
        </div>
        <div className="flex items-center gap-1 bg-[#111118] border border-slate-800 rounded-xl p-1 flex-wrap">
          {['ALL', ...STATUS_ORDER].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === s ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              {s === 'ALL' ? 'Tous' : PROJECT_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {loading ? <div className="text-slate-500 text-sm">Chargement...</div> : (
        <div className="space-y-3">
          {filtered.map(project => {
            const progress = taskProgress(project.tasks)
            return (
              <Link key={project.id} href={`/projects/${project.id}`}
                className="flex items-center gap-6 bg-[#111118] border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-white font-medium group-hover:text-violet-300 transition-colors">{project.name}</h3>
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
                        <div className="h-full bg-violet-500 rounded-full" style={{ width: `${progress}%` }} />
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
            )
          })}
          {filtered.length === 0 && <div className="text-center py-16 text-slate-500">Aucun projet</div>}
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
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors" />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Client *</label>
                <select required value={form.clientId} onChange={e => setForm({ ...form, clientId: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors">
                  <option value="">Sélectionner un client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Type</label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors">
                    <option value="WORDPRESS">WordPress</option>
                    <option value="FRAMER">Framer</option>
                    <option value="CUSTOM">Sur mesure</option>
                    <option value="ECOMMERCE">E-commerce</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Statut</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors">
                    {STATUS_ORDER.map(s => <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Prix (€)</label>
                  <input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Deadline</label>
                  <input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors" />
                </div>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-2">Services inclus</label>
                <div className="flex flex-wrap gap-2">
                  {SERVICES.map(s => (
                    <button key={s} type="button" onClick={() => toggleService(s)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${form.services.includes(s) ? 'bg-violet-600/20 border-violet-500 text-violet-300' : 'border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors">Annuler</button>
                <button type="submit" className="flex-1 bg-violet-600 hover:bg-violet-500 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">Créer le projet</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
