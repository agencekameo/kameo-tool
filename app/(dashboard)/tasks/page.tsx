'use client'

import { useEffect, useState, useRef } from 'react'
import { Plus, GripVertical, Circle, CheckCircle2, Clock, RotateCcw, Trash2, Filter } from 'lucide-react'
import { TASK_PRIORITY_COLORS, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, formatDate } from '@/lib/utils'
import { useSession } from 'next-auth/react'
import Link from 'next/link'

interface Task {
  id: string
  title: string
  description?: string
  status: string
  priority: string
  dueDate?: string
  project?: { id: string; name: string; client: { name: string } } | null
  assignee?: { id: string; name: string }
}

interface Project { id: string; name: string; client: { name: string } }
interface User { id: string; name: string }

const PRIORITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

const STATUS_COLORS: Record<string, string> = {
  TODO: 'text-slate-500',
  IN_PROGRESS: 'text-blue-400',
  REVIEW: 'text-orange-400',
  DONE: 'text-green-400',
}

const STATUS_CYCLE: Record<string, string> = {
  TODO: 'IN_PROGRESS',
  IN_PROGRESS: 'DONE',
  REVIEW: 'DONE',
  DONE: 'TODO',
}

const STATUS_BG: Record<string, string> = {
  TODO: 'bg-slate-800 text-slate-400',
  IN_PROGRESS: 'bg-blue-500/15 text-blue-400',
  REVIEW: 'bg-orange-500/15 text-orange-400',
  DONE: 'bg-green-500/15 text-green-400',
}

export default function TasksPage() {
  const { data: session } = useSession()
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [quickAdd, setQuickAdd] = useState('')
  const [filterUser, setFilterUser] = useState('TOUS')
  const [form, setForm] = useState({
    title: '', description: '', status: 'TODO', priority: 'MEDIUM',
    projectId: '', assigneeId: '', dueDate: '',
  })
  const dragItem = useRef<number | null>(null)
  const dragOver = useRef<number | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/tasks').then(r => r.json()),
      fetch('/api/projects').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
    ]).then(([t, p, u]) => {
      const sorted = [...t].sort((a: Task, b: Task) => {
        const pa = PRIORITY_ORDER.indexOf(a.priority)
        const pb = PRIORITY_ORDER.indexOf(b.priority)
        if (pa !== pb) return pa - pb
        return a.status.localeCompare(b.status)
      })
      setTasks(sorted)
      setProjects(p)
      setUsers(u)
    }).finally(() => setLoading(false))
  }, [])

  const activeTasks = tasks.filter(t => t.status !== 'DONE')
  const doneTasks = tasks.filter(t => t.status === 'DONE')

  const filteredActive = activeTasks.filter(t =>
    filterUser === 'TOUS' || t.assignee?.id === filterUser
  )
  const filteredDone = doneTasks.filter(t =>
    filterUser === 'TOUS' || t.assignee?.id === filterUser
  )

  async function cycleStatus(task: Task) {
    const newStatus = STATUS_CYCLE[task.status]
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        assigneeId: form.assigneeId || null,
        dueDate: form.dueDate || null,
      }),
    })
    const task = await res.json()
    setTasks(prev => {
      const next = [...prev, task].sort((a: Task, b: Task) => {
        const pa = PRIORITY_ORDER.indexOf(a.priority)
        const pb = PRIORITY_ORDER.indexOf(b.priority)
        if (pa !== pb) return pa - pb
        return a.status.localeCompare(b.status)
      })
      return next
    })
    setShowModal(false)
    setForm({ title: '', description: '', status: 'TODO', priority: 'MEDIUM', projectId: '', assigneeId: '', dueDate: '' })
    setQuickAdd('')
  }

  function openModalWithTitle(title: string) {
    setForm(f => ({ ...f, title }))
    setShowModal(true)
  }

  function handleQuickAddKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && quickAdd.trim()) {
      openModalWithTitle(quickAdd.trim())
    }
  }

  function handleDragStart(idx: number) { dragItem.current = idx }
  function handleDragEnter(idx: number) { dragOver.current = idx }

  async function handleDrop() {
    if (dragItem.current === null || dragOver.current === null) return
    const items = [...filteredActive]
    const dragged = items.splice(dragItem.current, 1)[0]
    items.splice(dragOver.current, 0, dragged)
    setTasks(prev => {
      const ids = new Set(items.map(t => t.id))
      return [...prev.filter(t => !ids.has(t.id)), ...items]
    })
    dragItem.current = null
    dragOver.current = null
  }

  return (
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Tâches</h1>
          <p className="text-slate-400 text-sm mt-1">
            {filteredActive.length} en cours · {filteredDone.length} terminée{filteredDone.length > 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Member filter */}
          <div className="flex items-center gap-2 bg-[#111118] border border-slate-800 rounded-xl px-3 py-2">
            <Filter size={14} className="text-slate-500" />
            <select
              value={filterUser}
              onChange={e => setFilterUser(e.target.value)}
              className="bg-transparent text-slate-400 text-sm focus:outline-none cursor-pointer"
            >
              <option value="TOUS">Tous les membres</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => { setForm(f => ({ ...f, title: quickAdd })); setShowModal(true) }}
            className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            <Plus size={16} /> Nouvelle tâche
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-slate-500 text-sm">Chargement...</div>
      ) : (
        <div className="space-y-2">
          {/* Quick add row */}
          <div className="bg-[#111118] border border-dashed border-slate-700 rounded-2xl px-4 py-3 flex items-center gap-3 hover:border-slate-600 transition-colors">
            <Plus size={16} className="text-slate-600 flex-shrink-0" />
            <input
              value={quickAdd}
              onChange={e => setQuickAdd(e.target.value)}
              onKeyDown={handleQuickAddKeyDown}
              placeholder="Ajouter une tâche... (Entrée pour ouvrir le formulaire)"
              className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 focus:outline-none"
            />
            {quickAdd.trim() && (
              <button
                onClick={() => openModalWithTitle(quickAdd.trim())}
                className="text-xs text-[#E14B89] hover:opacity-80 transition-opacity flex-shrink-0"
              >
                Ouvrir
              </button>
            )}
          </div>

          {/* Active tasks */}
          {filteredActive.length === 0 && (
            <div className="text-center py-12">
              <p className="text-slate-500">Aucune tâche en cours</p>
              <p className="text-slate-600 text-sm mt-1">Cliquez sur &quot;Nouvelle tâche&quot; pour commencer</p>
            </div>
          )}

          {filteredActive.map((task, idx) => (
            <div
              key={task.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragEnter={() => handleDragEnter(idx)}
              onDragEnd={handleDrop}
              onDragOver={e => e.preventDefault()}
              className="bg-[#111118] border border-slate-800 rounded-2xl p-4 flex items-center gap-3 group hover:border-slate-700 transition-colors cursor-grab active:cursor-grabbing active:opacity-70"
            >
              <GripVertical size={16} className="text-slate-700 group-hover:text-slate-500 flex-shrink-0 transition-colors" />

              {/* Status toggle */}
              <button onClick={() => cycleStatus(task)} className="flex-shrink-0">
                {task.status === 'DONE'
                  ? <CheckCircle2 size={18} className="text-green-400" />
                  : <Circle size={18} className={`${STATUS_COLORS[task.status]} hover:text-[#E14B89] transition-colors`} />
                }
              </button>

              {/* Title + subtitle */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{task.title}</p>
                {task.project && (
                  <p className="text-slate-500 text-xs mt-0.5 truncate">
                    <Link href={`/projects/${task.project.id}`} className="hover:text-[#E14B89] transition-colors">
                      {task.project.client.name} · {task.project.name}
                    </Link>
                  </p>
                )}
              </div>

              {/* Status badge */}
              <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_BG[task.status]}`}>
                {TASK_STATUS_LABELS[task.status]}
              </span>

              {/* Due date */}
              {task.dueDate ? (
                <span className="text-slate-500 text-xs flex items-center gap-1 flex-shrink-0">
                  <Clock size={11} />{formatDate(task.dueDate)}
                </span>
              ) : (
                <span className="w-20 flex-shrink-0" />
              )}

              {/* Assignee */}
              {task.assignee ? (
                <span className="text-slate-400 text-xs flex-shrink-0 w-24 truncate text-right">{task.assignee.name}</span>
              ) : (
                <span className="w-24 flex-shrink-0" />
              )}

              {/* Delete */}
              <button
                onClick={() => deleteTask(task.id)}
                className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all p-1 flex-shrink-0"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}

          {/* Done section */}
          {filteredDone.length > 0 && (
            <div className="mt-6">
              <p className="text-slate-600 text-xs font-medium uppercase tracking-wider mb-3">
                Terminées ({filteredDone.length})
              </p>
              <div className="space-y-1">
                {filteredDone.map(task => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl opacity-50 hover:opacity-70 transition-opacity group"
                  >
                    <button onClick={() => cycleStatus(task)} className="flex-shrink-0">
                      <CheckCircle2 size={16} className="text-green-400" />
                    </button>
                    <p className="text-slate-500 text-sm line-through flex-1 truncate">{task.title}</p>
                    {task.project && (
                      <span className="text-slate-600 text-xs flex-shrink-0">
                        {task.project.client.name} · {task.project.name}
                      </span>
                    )}
                    {task.assignee && (
                      <span className="text-slate-600 text-xs flex-shrink-0">{task.assignee.name}</span>
                    )}
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all flex-shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-white font-semibold text-lg mb-5">Nouvelle tâche</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Titre *</label>
                <input
                  required
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Projet</label>
                <select
                  value={form.projectId}
                  onChange={e => setForm({ ...form, projectId: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                >
                  <option value="">Sans projet</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.client.name} · {p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Statut</label>
                <select
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                >
                  <option value="TODO">À faire</option>
                  <option value="IN_PROGRESS">En cours</option>
                  <option value="DONE">Terminé</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Assigné à</label>
                  <select
                    value={form.assigneeId}
                    onChange={e => setForm({ ...form, assigneeId: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                  >
                    <option value="">Non assigné</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Échéance</label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={e => setForm({ ...form, dueDate: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setForm({ title: '', description: '', status: 'TODO', priority: 'MEDIUM', projectId: '', assigneeId: '', dueDate: '' }) }}
                  className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#E14B89] hover:opacity-90 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
