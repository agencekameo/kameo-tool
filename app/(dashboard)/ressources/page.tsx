'use client'

import { useEffect, useState, useRef } from 'react'
import { usePolling } from '@/hooks/usePolling'
import {
  FileText, Plus, Trash2, Download, Link, Sparkles, X,
  ChevronRight, Search, Calendar, FolderKanban, Loader2, Eye, Pencil,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Project {
  id: string
  name: string
}

interface CahierDesCharges {
  id: string
  title: string
  content: string
  prompt?: string
  projectId?: string
  template: string
  createdAt: string
  updatedAt: string
  project?: { id: string; name: string }
  createdBy?: { id: string; name: string }
}

export default function RessourcesPage() {
  const [docs, setDocs] = useState<CahierDesCharges[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<CahierDesCharges | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingContent, setEditingContent] = useState(false)

  const [form, setForm] = useState({
    title: '',
    prompt: '',
    projectId: '',
    content: '',
  })

  const contentRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/cahier-des-charges').then(r => r.json()),
      fetch('/api/projects').then(r => r.json()),
    ]).then(([docData, projData]) => {
      setDocs(Array.isArray(docData) ? docData : [])
      setProjects(Array.isArray(projData) ? projData : [])
    }).finally(() => setLoading(false))
  }, [])

  function refreshData() {
    Promise.all([
      fetch('/api/cahier-des-charges').then(r => r.json()),
      fetch('/api/projects').then(r => r.json()),
    ]).then(([docData, projData]) => {
      setDocs(Array.isArray(docData) ? docData : [])
      setProjects(Array.isArray(projData) ? projData : [])
    }).catch(() => {})
  }

  usePolling(refreshData)

  const filtered = docs.filter(d =>
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    d.project?.name.toLowerCase().includes(search.toLowerCase())
  )

  async function handleGenerate() {
    if (!form.prompt.trim() || !form.title.trim()) return
    setGenerating(true)
    try {
      const res = await fetch('/api/cahier-des-charges/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: form.prompt, title: form.title }),
      })
      const data = await res.json()
      if (data.error) {
        alert(data.error)
        return
      }
      setForm(prev => ({ ...prev, content: data.content }))
    } catch {
      alert('Erreur lors de la génération')
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    if (!form.title.trim() || !form.content.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/cahier-des-charges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          content: form.content,
          prompt: form.prompt || null,
          projectId: form.projectId || null,
          template: 'standard',
        }),
      })
      const doc = await res.json()
      setDocs(prev => [doc, ...prev])
      setSelected(doc)
      setShowCreate(false)
      setForm({ title: '', prompt: '', projectId: '', content: '' })
    } catch {
      alert('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce cahier des charges ?')) return
    await fetch(`/api/cahier-des-charges/${id}`, { method: 'DELETE' })
    setDocs(prev => prev.filter(d => d.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  async function handleUpdateContent() {
    if (!selected) return
    setSaving(true)
    try {
      const res = await fetch(`/api/cahier-des-charges/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: selected.content }),
      })
      const doc = await res.json()
      setDocs(prev => prev.map(d => d.id === doc.id ? doc : d))
      setSelected(doc)
      setEditingContent(false)
    } catch {
      alert('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  async function handleLinkProject(docId: string, projectId: string) {
    const res = await fetch(`/api/cahier-des-charges/${docId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: projectId || null }),
    })
    const doc = await res.json()
    setDocs(prev => prev.map(d => d.id === doc.id ? doc : d))
    if (selected?.id === doc.id) setSelected(doc)
  }

  function handleDownload(doc: CahierDesCharges) {
    const blob = new Blob([doc.content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${doc.title.replace(/[^a-z0-9]/gi, '_')}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left panel: list */}
      <div className="w-72 flex-shrink-0 border-r border-slate-800 flex flex-col bg-[#0d0d14]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-[#E14B89]" />
              <h1 className="text-white font-semibold">Cahier des charges</h1>
            </div>
            <button
              onClick={() => { setShowCreate(true); setSelected(null) }}
              className="p-1.5 rounded-lg bg-[#E14B89]/10 text-[#E14B89] hover:bg-[#E14B89]/20 transition-colors"
              title="Nouveau cahier des charges"
            >
              <Plus size={15} />
            </button>
          </div>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#111118] border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-slate-700"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-slate-500 text-xs">Chargement...</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center">
              <FileText size={28} className="text-slate-700 mx-auto mb-2" />
              <p className="text-slate-500 text-xs">Aucun cahier des charges</p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-2 text-[#E14B89] text-xs hover:underline"
              >
                Créer le premier →
              </button>
            </div>
          ) : (
            filtered.map(doc => (
              <button
                key={doc.id}
                onClick={() => { setSelected(doc); setShowCreate(false); setEditingContent(false) }}
                className={cn(
                  'w-full text-left px-4 py-3 border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors',
                  selected?.id === doc.id && 'bg-[#E14B89]/10 border-l-2 border-l-[#E14B89]'
                )}
              >
                <p className={cn(
                  'text-sm font-medium truncate',
                  selected?.id === doc.id ? 'text-white' : 'text-slate-300'
                )}>
                  {doc.title}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {doc.project && (
                    <span className="flex items-center gap-1 text-[10px] text-[#E14B89]/70">
                      <FolderKanban size={10} />
                      {doc.project.name}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-600">
                    {new Date(doc.updatedAt).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0a0f]">
        {/* Create form */}
        {showCreate && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-white text-xl font-semibold">Nouveau cahier des charges</h2>
                <button onClick={() => setShowCreate(false)} className="text-slate-500 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-slate-400 text-xs font-medium mb-1.5">Titre du projet *</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Ex: Site e-commerce bijouterie"
                    className="w-full bg-[#111118] border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-[#E14B89] transition-colors"
                  />
                </div>

                {/* Project link */}
                <div>
                  <label className="block text-slate-400 text-xs font-medium mb-1.5">Lier à un projet (optionnel)</label>
                  <select
                    value={form.projectId}
                    onChange={e => setForm(prev => ({ ...prev, projectId: e.target.value }))}
                    className="w-full bg-[#111118] border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                  >
                    <option value="">— Aucun projet —</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Prompt */}
                <div>
                  <label className="block text-slate-400 text-xs font-medium mb-1.5">
                    Résumé du projet *
                    <span className="text-slate-600 font-normal ml-1">(l&apos;IA va générer le cahier des charges complet)</span>
                  </label>
                  <textarea
                    value={form.prompt}
                    onChange={e => setForm(prev => ({ ...prev, prompt: e.target.value }))}
                    placeholder="Décrivez le projet : type de site, secteur d'activité, fonctionnalités souhaitées, public cible, style visuel souhaité, contraintes particulières..."
                    rows={5}
                    className="w-full bg-[#111118] border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-[#E14B89] transition-colors resize-none"
                  />
                </div>

                {/* Generate button */}
                <button
                  onClick={handleGenerate}
                  disabled={generating || !form.prompt.trim() || !form.title.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#E14B89] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-all"
                >
                  {generating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Génération en cours... (30-60 sec)
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      Générer avec l&apos;IA
                    </>
                  )}
                </button>

                {/* Generated content */}
                {form.content && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-slate-400 text-xs font-medium">
                        Contenu généré (modifiable)
                      </label>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors"
                      >
                        {saving ? <Loader2 size={13} className="animate-spin" /> : null}
                        Sauvegarder
                      </button>
                    </div>
                    <textarea
                      value={form.content}
                      onChange={e => setForm(prev => ({ ...prev, content: e.target.value }))}
                      rows={20}
                      className="w-full bg-[#111118] border border-slate-800 rounded-xl px-4 py-3 text-slate-200 text-xs font-mono focus:outline-none focus:border-slate-700 transition-colors resize-none"
                    />
                    <div className="flex gap-3 mt-3">
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
                      >
                        {saving ? <Loader2 size={15} className="animate-spin" /> : null}
                        Sauvegarder
                      </button>
                      <button
                        onClick={() => {
                          const doc = { title: form.title, content: form.content } as CahierDesCharges
                          handleDownload(doc)
                        }}
                        className="flex items-center gap-2 px-5 py-2.5 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 rounded-xl text-sm transition-colors"
                      >
                        <Download size={15} />
                        Télécharger (.md)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Document view */}
        {selected && !showCreate && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Doc header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-start justify-between gap-4 flex-shrink-0">
              <div className="flex-1 min-w-0">
                <h2 className="text-white text-lg font-semibold truncate">{selected.title}</h2>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {selected.project && (
                    <span className="flex items-center gap-1 text-xs text-[#E14B89]/80">
                      <FolderKanban size={12} />
                      {selected.project.name}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <Calendar size={11} />
                    {new Date(selected.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                  {selected.createdBy && (
                    <span className="text-xs text-slate-600">par {selected.createdBy.name}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Link to project */}
                <select
                  value={selected.projectId ?? ''}
                  onChange={e => handleLinkProject(selected.id, e.target.value)}
                  className="bg-[#111118] border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-400 text-xs focus:outline-none focus:border-slate-700"
                  title="Lier à un projet"
                >
                  <option value="">Lier à un projet...</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => setEditingContent(v => !v)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors',
                    editingContent
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'border border-slate-700 text-slate-400 hover:text-white'
                  )}
                >
                  <Pencil size={13} />
                  {editingContent ? 'Mode édition' : 'Modifier'}
                </button>
                {editingContent && (
                  <button
                    onClick={handleUpdateContent}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs transition-colors"
                  >
                    {saving ? <Loader2 size={13} className="animate-spin" /> : null}
                    Sauvegarder
                  </button>
                )}
                <button
                  onClick={() => handleDownload(selected)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-700 text-slate-400 hover:text-white rounded-lg text-xs transition-colors"
                  title="Télécharger"
                >
                  <Download size={13} />
                  .md
                </button>
                <button
                  onClick={() => handleDelete(selected.id)}
                  className="p-1.5 border border-slate-800 text-slate-600 hover:text-red-400 hover:border-red-400/30 rounded-lg transition-colors"
                  title="Supprimer"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {editingContent ? (
                <textarea
                  value={selected.content}
                  onChange={e => setSelected(prev => prev ? { ...prev, content: e.target.value } : null)}
                  className="w-full h-full min-h-[600px] bg-[#111118] border border-slate-800 rounded-xl px-4 py-3 text-slate-200 text-sm font-mono focus:outline-none focus:border-slate-700 transition-colors resize-none"
                />
              ) : (
                <MarkdownPreview content={selected.content} />
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!selected && !showCreate && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FileText size={48} className="text-slate-800 mx-auto mb-4" />
              <p className="text-slate-500 text-sm">Sélectionnez un cahier des charges</p>
              <p className="text-slate-600 text-xs mt-1">ou créez-en un nouveau avec l&apos;IA</p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-[#E14B89]/10 border border-[#E14B89]/20 text-[#E14B89] rounded-xl text-sm hover:bg-[#E14B89]/20 transition-colors mx-auto"
              >
                <Sparkles size={15} />
                Créer avec l&apos;IA
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Simple markdown renderer (basic, no library needed)
function MarkdownPreview({ content }: { content: string }) {
  const lines = content.split('\n')

  return (
    <div className="max-w-3xl mx-auto prose prose-invert prose-sm">
      {lines.map((line, i) => {
        // H1
        if (line.startsWith('# ')) {
          return <h1 key={i} className="text-2xl font-bold text-white mt-6 mb-3 pb-2 border-b border-slate-800">{line.slice(2)}</h1>
        }
        // H2
        if (line.startsWith('## ')) {
          return <h2 key={i} className="text-lg font-semibold text-white mt-6 mb-2">{line.slice(3)}</h2>
        }
        // H3
        if (line.startsWith('### ')) {
          return <h3 key={i} className="text-sm font-semibold text-slate-300 mt-4 mb-1.5">{line.slice(4)}</h3>
        }
        // HR
        if (line.startsWith('---')) {
          return <hr key={i} className="border-slate-800 my-5" />
        }
        // Table row
        if (line.startsWith('|')) {
          const cells = line.split('|').filter(c => c.trim() !== '')
          const isSeparator = cells.every(c => c.trim().match(/^[-:]+$/))
          if (isSeparator) return null
          const isHeader = lines[i + 1]?.startsWith('|') && lines[i + 1]?.includes('---')
          return (
            <div key={i} className={cn('grid text-xs py-2 px-3 border-b border-slate-800', isHeader ? 'bg-slate-800/50 text-slate-300 font-semibold' : 'text-slate-400')} style={{ gridTemplateColumns: `repeat(${cells.length}, 1fr)` }}>
              {cells.map((cell, j) => <span key={j}>{cell.trim()}</span>)}
            </div>
          )
        }
        // Bullet
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return <li key={i} className="text-slate-300 text-sm ml-4 mb-1">{renderInline(line.slice(2))}</li>
        }
        // Numbered list
        if (/^\d+\.\s/.test(line)) {
          return <li key={i} className="text-slate-300 text-sm ml-4 mb-1 list-decimal">{renderInline(line.replace(/^\d+\.\s/, ''))}</li>
        }
        // Bold metadata lines (e.g. **Date :** ...)
        if (line.startsWith('**') && line.includes(':**')) {
          return <p key={i} className="text-slate-400 text-sm mb-0.5">{renderInline(line)}</p>
        }
        // Empty line
        if (line.trim() === '') {
          return <div key={i} className="h-2" />
        }
        // Normal paragraph
        return <p key={i} className="text-slate-300 text-sm mb-1 leading-relaxed">{renderInline(line)}</p>
      })}
    </div>
  )
}

function renderInline(text: string): React.ReactNode {
  // Handle **bold** and *italic*
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i} className="italic text-slate-300">{part.slice(1, -1)}</em>
    }
    return part
  })
}
