'use client'

import { useEffect, useState } from 'react'
import { Plus, Search, Pin, Pencil, Trash2, X, Check } from 'lucide-react'
import { RESOURCE_CATEGORY_COLORS, RESOURCE_CATEGORY_LABELS } from '@/lib/utils'

interface Resource {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
  pinned: boolean
  createdAt: string
  updatedAt: string
}

const CATEGORIES = ['PROCESS', 'PLUGIN', 'PROMPT', 'SEO', 'AUTRE']

export default function WikiPage() {
  const [resources, setResources] = useState<Resource[]>([])
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Resource | null>(null)
  const [form, setForm] = useState({ title: '', content: '', category: 'PROCESS', tags: '', pinned: false })

  useEffect(() => {
    fetch('/api/resources').then(r => r.json()).then(setResources).finally(() => setLoading(false))
  }, [])

  const filtered = resources.filter(r => {
    const matchSearch = r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.content.toLowerCase().includes(search.toLowerCase()) ||
      r.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
    const matchCat = filterCat === 'ALL' || r.category === filterCat
    return matchSearch && matchCat
  })

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const data = { ...form, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean) }
    if (editingId) {
      const res = await fetch(`/api/resources/${editingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      const updated = await res.json()
      setResources(prev => prev.map(r => r.id === editingId ? updated : r))
      if (selected?.id === editingId) setSelected(updated)
    } else {
      const res = await fetch('/api/resources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      const resource = await res.json()
      setResources(prev => [resource, ...prev])
    }
    setShowModal(false)
    setEditingId(null)
    setForm({ title: '', content: '', category: 'GUIDE', tags: '', pinned: false })
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette ressource ?')) return
    await fetch(`/api/resources/${id}`, { method: 'DELETE' })
    setResources(prev => prev.filter(r => r.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  async function togglePin(resource: Resource) {
    const res = await fetch(`/api/resources/${resource.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pinned: !resource.pinned }) })
    const updated = await res.json()
    setResources(prev => prev.map(r => r.id === resource.id ? updated : r))
  }

  function startEdit(resource: Resource) {
    setForm({ title: resource.title, content: resource.content, category: resource.category, tags: resource.tags.join(', '), pinned: resource.pinned })
    setEditingId(resource.id)
    setShowModal(true)
  }

  function copyContent(content: string) {
    navigator.clipboard.writeText(content)
  }

  return (
    <div className="p-4 sm:p-8 h-screen flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Wiki & Ressources</h1>
          <p className="text-slate-400 text-sm mt-1">{resources.length} ressource{resources.length > 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => { setEditingId(null); setForm({ title: '', content: '', category: 'PROCESS', tags: '', pinned: false }); setShowModal(true) }}
          className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
          <Plus size={16} /> Nouvelle ressource
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
            className="bg-[#111118] border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#E14B89] transition-colors w-56" />
        </div>
        <div className="flex items-center gap-1 bg-[#111118] border border-slate-800 rounded-xl p-1 flex-wrap">
          <button onClick={() => setFilterCat('ALL')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterCat === 'ALL' ? 'bg-[#E14B89] text-white' : 'text-slate-400 hover:text-white'}`}>
            Tous
          </button>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setFilterCat(c)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterCat === c ? 'bg-[#E14B89] text-white' : 'text-slate-400 hover:text-white'}`}>
              {RESOURCE_CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </div>

      {/* Split layout */}
      <div className="flex gap-5 flex-1 min-h-0">
        {/* List */}
        <div className="w-80 flex-shrink-0 overflow-y-auto space-y-2">
          {loading ? <div className="text-slate-500 text-sm">Chargement...</div> : (
            filtered.map(resource => (
              <div key={resource.id}
                onClick={() => setSelected(resource)}
                className={`p-4 rounded-xl border cursor-pointer transition-colors group ${selected?.id === resource.id ? 'bg-[#E14B89]/10 border-[#E14B89]/30' : 'bg-[#111118] border-slate-800 hover:border-slate-700'}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {resource.pinned && <Pin size={12} className="text-[#E14B89] flex-shrink-0" />}
                    <p className="text-white text-sm font-medium truncate">{resource.title}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button onClick={e => { e.stopPropagation(); startEdit(resource) }} className="text-slate-500 hover:text-[#E14B89] transition-colors p-0.5">
                      <Pencil size={12} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); handleDelete(resource.id) }} className="text-slate-500 hover:text-red-400 transition-colors p-0.5">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${RESOURCE_CATEGORY_COLORS[resource.category]}`}>
                  {RESOURCE_CATEGORY_LABELS[resource.category]}
                </span>
                {resource.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {resource.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="text-xs text-slate-500">#{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
          {filtered.length === 0 && !loading && (
            <div className="text-slate-500 text-sm text-center py-12">Aucune ressource</div>
          )}
        </div>

        {/* Content viewer */}
        <div className="flex-1 bg-[#111118] border border-slate-800 rounded-2xl overflow-hidden">
          {selected ? (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <h2 className="text-white font-medium">{selected.title}</h2>
                  <span className={`text-xs px-2.5 py-1 rounded-full ${RESOURCE_CATEGORY_COLORS[selected.category]}`}>
                    {RESOURCE_CATEGORY_LABELS[selected.category]}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => togglePin(selected)} className={`p-2 rounded-lg transition-colors ${selected.pinned ? 'text-[#E14B89] bg-[#E14B89]/10' : 'text-slate-500 hover:text-[#E14B89]'}`}>
                    <Pin size={15} />
                  </button>
                  <button onClick={() => copyContent(selected.content)} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors">
                    Copier
                  </button>
                  <button onClick={() => startEdit(selected)} className="flex items-center gap-1.5 text-xs text-[#E14B89] hover:text-[#F8903C] bg-[#E14B89]/10 hover:opacity-90/20 px-3 py-1.5 rounded-lg transition-colors">
                    <Pencil size={12} /> Modifier
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <pre className="text-slate-300 text-sm whitespace-pre-wrap font-mono leading-relaxed">{selected.content}</pre>
                {selected.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-6 pt-6 border-t border-slate-800">
                    {selected.tags.map(tag => (
                      <span key={tag} className="text-xs bg-slate-800 text-slate-400 px-2.5 py-1 rounded-full">#{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500">
              <div className="text-center">
                <p className="text-sm">Sélectionnez une ressource</p>
                <p className="text-xs mt-1 text-slate-600">pour afficher son contenu</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-white font-semibold text-lg mb-5">{editingId ? 'Modifier la ressource' : 'Nouvelle ressource'}</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Titre *</label>
                  <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Catégorie</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                    {CATEGORIES.map(c => <option key={c} value={c}>{RESOURCE_CATEGORY_LABELS[c]}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Contenu *</label>
                <textarea required value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} rows={12}
                  placeholder="Contenu de la ressource (prompt, guide, plugin info...)"
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none font-mono" />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Tags (séparés par des virgules)</label>
                <input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="seo, audit, wordpress..."
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <div onClick={() => setForm({ ...form, pinned: !form.pinned })}
                  className={`w-8 h-5 rounded-full transition-colors flex items-center px-0.5 ${form.pinned ? 'bg-[#E14B89]' : 'bg-slate-700'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${form.pinned ? 'translate-x-3' : 'translate-x-0'}`} />
                </div>
                <span className="text-slate-400 text-sm">Épingler en haut</span>
              </label>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors">Annuler</button>
                <button type="submit" className="flex-1 bg-[#E14B89] hover:opacity-90 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
                  {editingId ? 'Sauvegarder' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
