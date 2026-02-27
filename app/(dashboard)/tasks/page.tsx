'use client'

import { useEffect, useState } from 'react'
import { Plus, CheckCircle2, Circle, Clock } from 'lucide-react'
import { TASK_PRIORITY_COLORS, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, formatDate } from '@/lib/utils'
import Link from 'next/link'

interface Task {
  id: string
  title: string
  description?: string
  status: string
  priority: string
  dueDate?: string
  project: { id: string; name: string; client: { name: string } }
  assignee?: { id: string; name: string }
}

interface Project { id: string; name: string; client: { name: string } }
interface User { id: string; name: string }

const STATUS_COLS = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']
const STATUS_COL_LABELS: Record<string, string> = { TODO: 'À faire', IN_PROGRESS: 'En cours', REVIEW: 'Review', DONE: 'Terminé' }
const STATUS_COL_COLORS: Record<string, string> = { TODO: 'text-slate-400', IN_PROGRESS: 'text-blue-400', REVIEW: 'text-orange-400', DONE: 'text-green-400' }

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', status: 'TODO', priority: 'MEDIUM', projectId: '', assigneeId: '', dueDate: '' })

  useEffect(() => {
    Promise.all([
      fetch('/api/tasks').then(r => r.json()),
      fetch('/api/projects').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
    ]).then(([t, p, u]) => { setTasks(t); setProjects(p); setUsers(u) }).finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, assigneeId: form.assigneeId || null, dueDate: form.dueDate || null }),
    })
    const task = await res.json()
    setTasks(prev => [task, ...prev])
    setShowModal(false)
    setForm({ title: '', description: '', status: 'TODO', priority: 'MEDIUM', projectId: '', assigneeId: '', dueDate: '' })
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/tasks/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t))
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Tâches</h1>
          <p className="text-slate-400 text-sm mt-1">{tasks.filter(t => t.status !== 'DONE').length} en cours</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
          <Plus size={16} /> Nouvelle tâche
        </button>
      </div>

      {loading ? <div className="text-slate-500">Chargement...</div> : (
        <div className="grid grid-cols-4 gap-4">
          {STATUS_COLS.map(col => {
            const colTasks = tasks.filter(t => t.status === col)
            return (
              <div key={col} className="bg-[#0d0d14] rounded-2xl p-4">
                <div className={`flex items-center gap-2 mb-4 ${STATUS_COL_COLORS[col]}`}>
                  <span className="font-medium text-sm">{STATUS_COL_LABELS[col]}</span>
                  <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">{colTasks.length}</span>
                </div>
                <div className="space-y-2">
                  {colTasks.map(task => (
                    <div key={task.id} className="bg-[#111118] border border-slate-800 rounded-xl p-3">
                      <div className="flex items-start gap-2 mb-2">
                        <button onClick={() => updateStatus(task.id, task.status === 'DONE' ? 'TODO' : 'DONE')} className="mt-0.5 flex-shrink-0">
                          {task.status === 'DONE'
                            ? <CheckCircle2 size={15} className="text-green-400" />
                            : <Circle size={15} className="text-slate-600 hover:text-violet-400 transition-colors" />}
                        </button>
                        <p className={`text-sm font-medium leading-snug ${task.status === 'DONE' ? 'line-through text-slate-500' : 'text-white'}`}>{task.title}</p>
                      </div>
                      <Link href={`/projects/${task.project.id}`} className="text-slate-500 text-xs hover:text-violet-400 transition-colors block mb-2">
                        {task.project.client.name} · {task.project.name}
                      </Link>
                      <div className="flex items-center justify-between">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${TASK_PRIORITY_COLORS[task.priority]}`}>
                          {TASK_PRIORITY_LABELS[task.priority]}
                        </span>
                        {task.dueDate && (
                          <span className="text-slate-500 text-xs flex items-center gap-1">
                            <Clock size={10} />{formatDate(task.dueDate)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
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
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors" />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Projet *</label>
                <select required value={form.projectId} onChange={e => setForm({ ...form, projectId: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors">
                  <option value="">Sélectionner</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.client.name} · {p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Priorité</label>
                  <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors">
                    <option value="LOW">Faible</option>
                    <option value="MEDIUM">Normale</option>
                    <option value="HIGH">Haute</option>
                    <option value="CRITICAL">Critique</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Assigné à</label>
                  <select value={form.assigneeId} onChange={e => setForm({ ...form, assigneeId: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors">
                    <option value="">Non assigné</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Échéance</label>
                <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors" />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors">Annuler</button>
                <button type="submit" className="flex-1 bg-violet-600 hover:bg-violet-500 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">Créer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
