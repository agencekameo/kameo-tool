'use client'

import { useEffect, useState, useRef } from 'react'
import { Plus, GripVertical, Circle, CheckCircle2, Clock, RotateCcw, Trash2 } from 'lucide-react'
import { TASK_PRIORITY_COLORS, TASK_PRIORITY_LABELS, formatDate } from '@/lib/utils'
import { useSession } from 'next-auth/react'

interface Task {
  id: string
  title: string
  description?: string
  status: string
  priority: string
  dueDate?: string
  recurring: boolean
  recurrenceType?: string
  position: number
  project: { id: string; name: string; client: { name: string } }
  assignee?: { id: string; name: string }
}

interface Project { id: string; name: string; client: { name: string } }

const PRIORITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

const STATUS_COLORS: Record<string, string> = {
  TODO: 'text-slate-500',
  IN_PROGRESS: 'text-blue-400',
  REVIEW: 'text-orange-400',
  DONE: 'text-green-400',
}

const STATUS_CYCLE: Record<string, string> = {
  TODO: 'IN_PROGRESS',
  IN_PROGRESS: 'REVIEW',
  REVIEW: 'DONE',
  DONE: 'TODO',
}

export default function AyshaPage() {
  const { data: session } = useSession()
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [form, setForm] = useState({
    title: '', description: '', status: 'TODO', priority: 'HIGH',
    projectId: '', dueDate: '', recurring: false, recurrenceType: 'Semaine'
  })
  const dragItem = useRef<number | null>(null)
  const dragOver = useRef<number | null>(null)

  const isAdmin = (session?.user as { role?: string })?.role === 'ADMIN'

  useEffect(() => {
    Promise.all([
      fetch('/api/tasks').then(r => r.json()),
      fetch('/api/projects').then(r => r.json()),
    ]).then(([t, p]) => {
      // Sort by priority then position
      const sorted = [...t].sort((a: Task, b: Task) => {
        const pa = PRIORITY_ORDER.indexOf(a.priority)
        const pb = PRIORITY_ORDER.indexOf(b.priority)
        if (pa !== pb) return pa - pb
        return a.position - b.position
      })
      setTasks(sorted)
      setProjects(p)
    }).finally(() => setLoading(false))
  }, [])

  const displayedTasks = showAll
    ? tasks.filter(t => t.status !== 'DONE')
    : tasks.filter(t => {
        const assigneeId = (session?.user as { id?: string })?.id
        return t.assignee?.id === assigneeId || !t.assignee
      }).filter(t => t.status !== 'DONE')

  async function cycleStatus(task: Task) {
    const newStatus = STATUS_CYCLE[task.status]
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    })
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
  }

  async function deleteTask(id: string) {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        projectId: form.projectId,
        dueDate: form.dueDate || null,
        recurrenceType: form.recurring ? form.recurrenceType : null,
        position: tasks.length,
      })
    })
    const task = await res.json()
    setTasks(prev => {
      const next = [...prev, task].sort((a, b) => {
        const pa = PRIORITY_ORDER.indexOf(a.priority)
        const pb = PRIORITY_ORDER.indexOf(b.priority)
        if (pa !== pb) return pa - pb
        return a.position - b.position
      })
      return next
    })
    setShowModal(false)
    setForm({ title: '', description: '', status: 'TODO', priority: 'HIGH', projectId: '', dueDate: '', recurring: false, recurrenceType: 'Semaine' })
  }

  function handleDragStart(idx: number) { dragItem.current = idx }
  function handleDragEnter(idx: number) { dragOver.current = idx }

  async function handleDrop() {
    if (dragItem.current === null || dragOver.current === null) return
    const items = [...displayedTasks]
    const dragged = items.splice(dragItem.current, 1)[0]
    items.splice(dragOver.current, 0, dragged)
    // Update positions
    const updated = items.map((t, i) => ({ ...t, position: i }))
    setTasks(prev => {
      const ids = new Set(updated.map(t => t.id))
      return [...prev.filter(t => !ids.has(t.id)), ...updated].sort((a, b) => {
        const pa = PRIORITY_ORDER.indexOf(a.priority)
        const pb = PRIORITY_ORDER.indexOf(b.priority)
        if (pa !== pb) return pa - pb
        return a.position - b.position
      })
    })
    // Persist positions
    for (const t of updated) {
      fetch(`/api/tasks/${t.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: t.position })
      })
    }
    dragItem.current = null
    dragOver.current = null
  }

  const doneTasks = tasks.filter(t => t.status === 'DONE')

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Tâches Aysha</h1>
          <p className="text-slate-400 text-sm mt-1">
            {displayedTasks.length} tâche{displayedTasks.length > 1 ? 's' : ''} en cours · {doneTasks.length} terminée{doneTasks.length > 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-3">
          {isAdmin && (
            <button onClick={() => setShowAll(!showAll)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                showAll ? 'bg-[#E14B89]/10 text-[#E14B89] border-[#E14B89]/20' : 'border-slate-700 text-slate-400 hover:text-white'
              }`}>
              {showAll ? 'Toutes les tâches' : 'Mes tâches'}
            </button>
          )}
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
            <Plus size={16} /> Nouvelle tâche
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-slate-500 text-sm">Chargement...</div>
      ) : (
        <div className="space-y-2">
          {displayedTasks.length === 0 && (
            <div className="text-center py-16">
              <p className="text-slate-500">Aucune tâche en cours</p>
              <p className="text-slate-600 text-sm mt-1">Cliquez sur &quot;Nouvelle tâche&quot; pour commencer</p>
            </div>
          )}
          {displayedTasks.map((task, idx) => (
            <div key={task.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragEnter={() => handleDragEnter(idx)}
              onDragEnd={handleDrop}
              onDragOver={e => e.preventDefault()}
              className="bg-[#111118] border border-slate-800 rounded-2xl p-4 flex items-center gap-3 group hover:border-slate-700 transition-colors cursor-grab active:cursor-grabbing active:opacity-70">
              <GripVertical size={16} className="text-slate-700 group-hover:text-slate-500 flex-shrink-0 transition-colors" />
              <button onClick={() => cycleStatus(task)} className="flex-shrink-0">
                {task.status === 'DONE'
                  ? <CheckCircle2 size={18} className="text-green-400" />
                  : <Circle size={18} className={`${STATUS_COLORS[task.status]} hover:text-[#E14B89] transition-colors`} />
                }
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${task.status === 'DONE' ? 'line-through text-slate-500' : 'text-white'}`}>
                  {task.title}
                </p>
                <p className="text-slate-500 text-xs mt-0.5 truncate">
                  {task.project.client.name} · {task.project.name}
                  {task.assignee && ` · ${task.assignee.name}`}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full ${TASK_PRIORITY_COLORS[task.priority]}`}>
                  {TASK_PRIORITY_LABELS[task.priority]}
                </span>
                {task.recurring ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#E14B89]/10 text-[#E14B89] flex items-center gap-1">
                    <RotateCcw size={10} />{task.recurrenceType ?? 'Récurrent'}
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">One Shot</span>
                )}
                {task.dueDate && (
                  <span className="text-slate-500 text-xs flex items-center gap-1">
                    <Clock size={11} />{formatDate(task.dueDate)}
                  </span>
                )}
                <button onClick={() => deleteTask(task.id)}
                  className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all p-1">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}

          {/* Done section */}
          {doneTasks.length > 0 && (
            <div className="mt-6">
              <p className="text-slate-600 text-xs font-medium uppercase tracking-wider mb-3">Terminées ({doneTasks.length})</p>
              <div className="space-y-1">
                {doneTasks.map(task => (
                  <div key={task.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl opacity-50 hover:opacity-70 transition-opacity group">
                    <button onClick={() => cycleStatus(task)}>
                      <CheckCircle2 size={16} className="text-green-400" />
                    </button>
                    <p className="text-slate-500 text-sm line-through flex-1">{task.title}</p>
                    <button onClick={() => deleteTask(task.id)} className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-white font-semibold text-lg mb-5">Nouvelle tâche</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Titre *</label>
                <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Projet *</label>
                <select required value={form.projectId} onChange={e => setForm({ ...form, projectId: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                  <option value="">Sélectionner un projet</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.client.name} · {p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Priorité</label>
                  <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                    <option value="CRITICAL">Critique</option>
                    <option value="HIGH">Haute</option>
                    <option value="MEDIUM">Normale</option>
                    <option value="LOW">Faible</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Échéance</label>
                  <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.recurring} onChange={e => setForm({ ...form, recurring: e.target.checked })}
                    className="accent-[#E14B89]" />
                  <span className="text-slate-400 text-sm">Récurrent</span>
                </label>
                {form.recurring && (
                  <select value={form.recurrenceType} onChange={e => setForm({ ...form, recurrenceType: e.target.value })}
                    className="flex-1 bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                    <option value="Semaine">Chaque semaine</option>
                    <option value="Mensuel">Chaque mois</option>
                    <option value="One Shot">One Shot</option>
                  </select>
                )}
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors">Annuler</button>
                <button type="submit" className="flex-1 bg-[#E14B89] hover:opacity-90 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">Créer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
