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

interface Absence {
  id: string
  date: string
  endDate?: string
  type: 'CONGE' | 'RTT' | 'MALADIE' | 'FORMATION' | 'AUTRE'
  duration: number
  notes?: string
  user: { id: string; name: string }
}

interface User {
  id: string
  name: string
}

const ABSENCE_TYPE_LABELS: Record<string, string> = {
  CONGE: 'Congé payé',
  RTT: 'RTT',
  MALADIE: 'Maladie',
  FORMATION: 'Formation',
  AUTRE: 'Autre',
}

const ABSENCE_TYPE_COLORS: Record<string, string> = {
  CONGE: 'bg-blue-500/20 text-blue-400',
  RTT: 'bg-purple-500/20 text-purple-400',
  MALADIE: 'bg-red-500/20 text-red-400',
  FORMATION: 'bg-green-500/20 text-green-400',
  AUTRE: 'bg-slate-500/20 text-slate-400',
}

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

function groupAbsencesByMonth(absences: Absence[]) {
  const groups: Record<string, Absence[]> = {}
  absences.forEach(absence => {
    const date = new Date(absence.date)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    if (!groups[key]) groups[key] = []
    groups[key].push(absence)
  })
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
}

function formatMonthLabel(key: string) {
  const [year, month] = key.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1, 1)
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    .replace(/^./, c => c.toUpperCase())
}

function formatAbsenceDate(date: string, endDate?: string) {
  const start = new Date(date)
  const startStr = start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  if (!endDate) return startStr
  const end = new Date(endDate)
  if (start.toDateString() === end.toDateString()) return startStr
  const endStr = end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  return `${startStr} → ${endStr}`
}

export default function AyshaPage() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState<'tasks' | 'absences'>('tasks')

  // Tasks state
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

  // Absences state
  const [absences, setAbsences] = useState<Absence[]>([])
  const [absencesLoading, setAbsencesLoading] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [showAbsenceModal, setShowAbsenceModal] = useState(false)
  const [absenceForm, setAbsenceForm] = useState({
    userId: '',
    date: '',
    endDate: '',
    type: 'CONGE',
    duration: '1',
    notes: '',
  })

  const isAdmin = (session?.user as { role?: string })?.role === 'ADMIN'

  useEffect(() => {
    Promise.all([
      fetch('/api/tasks').then(r => r.json()),
      fetch('/api/projects').then(r => r.json()),
    ]).then(([t, p]) => {
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

  useEffect(() => {
    if (activeTab === 'absences') {
      fetchAbsences()
      if (isAdmin) {
        fetch('/api/users').then(r => r.json()).then(setUsers).catch(() => {})
      }
    }
  }, [activeTab, isAdmin])

  async function fetchAbsences() {
    setAbsencesLoading(true)
    try {
      const res = await fetch('/api/absences')
      const data = await res.json()
      setAbsences(data)
    } catch {
      // silent
    } finally {
      setAbsencesLoading(false)
    }
  }

  async function handleDeleteAbsence(id: string) {
    await fetch(`/api/absences/${id}`, { method: 'DELETE' })
    setAbsences(prev => prev.filter(a => a.id !== id))
  }

  async function handleCreateAbsence(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/absences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: absenceForm.userId,
        date: absenceForm.date,
        endDate: absenceForm.endDate || null,
        type: absenceForm.type,
        duration: parseFloat(absenceForm.duration),
        notes: absenceForm.notes || null,
      }),
    })
    const created = await res.json()
    setAbsences(prev => [created, ...prev])
    setShowAbsenceModal(false)
    setAbsenceForm({ userId: '', date: '', endDate: '', type: 'CONGE', duration: '1', notes: '' })
  }

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
  const groupedAbsences = groupAbsencesByMonth(absences)

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Aysha</h1>
          {activeTab === 'tasks' && (
            <p className="text-slate-400 text-sm mt-1">
              {displayedTasks.length} tâche{displayedTasks.length > 1 ? 's' : ''} en cours · {doneTasks.length} terminée{doneTasks.length > 1 ? 's' : ''}
            </p>
          )}
          {activeTab === 'absences' && (
            <p className="text-slate-400 text-sm mt-1">
              {absences.length} absence{absences.length > 1 ? 's' : ''} enregistrée{absences.length > 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div className="flex gap-3">
          {activeTab === 'tasks' && isAdmin && (
            <button onClick={() => setShowAll(!showAll)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                showAll ? 'bg-[#E14B89]/10 text-[#E14B89] border-[#E14B89]/20' : 'border-slate-700 text-slate-400 hover:text-white'
              }`}>
              {showAll ? 'Toutes les tâches' : 'Mes tâches'}
            </button>
          )}
          {activeTab === 'tasks' && (
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
              <Plus size={16} /> Nouvelle tâche
            </button>
          )}
          {activeTab === 'absences' && isAdmin && (
            <button onClick={() => setShowAbsenceModal(true)}
              className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
              <Plus size={16} /> Ajouter une absence
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#111118] border border-slate-800 rounded-xl p-1 mb-6 w-fit">
        {[{ key: 'tasks', label: 'Tâches' }, { key: 'absences', label: 'Absences' }].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as 'tasks' | 'absences')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.key ? 'bg-[#E14B89] text-white' : 'text-slate-400 hover:text-white'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tasks Tab */}
      {activeTab === 'tasks' && (
        <>
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
        </>
      )}

      {/* Absences Tab */}
      {activeTab === 'absences' && (
        <>
          {absencesLoading ? (
            <div className="text-slate-500 text-sm">Chargement...</div>
          ) : absences.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-slate-500">Aucune absence enregistrée</p>
              {isAdmin && (
                <p className="text-slate-600 text-sm mt-1">Cliquez sur &quot;Ajouter une absence&quot; pour commencer</p>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {groupedAbsences.map(([monthKey, monthAbsences]) => {
                const totalDays = monthAbsences.reduce((sum, a) => sum + a.duration, 0)
                return (
                  <div key={monthKey}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-slate-300 text-sm font-semibold uppercase tracking-wider">
                        {formatMonthLabel(monthKey)}
                      </h3>
                      <span className="text-slate-500 text-xs bg-slate-800/80 px-2.5 py-1 rounded-full">
                        {totalDays} jour{totalDays > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {monthAbsences.map(absence => (
                        <div key={absence.id}
                          className="bg-[#111118] border border-slate-800 rounded-2xl px-4 py-3 flex items-center gap-4 group hover:border-slate-700 transition-colors">
                          <div className="w-36 flex-shrink-0">
                            <p className="text-white text-sm">{formatAbsenceDate(absence.date, absence.endDate)}</p>
                          </div>
                          <div className="flex-shrink-0">
                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${ABSENCE_TYPE_COLORS[absence.type]}`}>
                              {ABSENCE_TYPE_LABELS[absence.type]}
                            </span>
                          </div>
                          <div className="flex-shrink-0 w-20">
                            <span className="text-slate-300 text-sm">
                              {absence.duration} j
                            </span>
                          </div>
                          <div className="flex-shrink-0 w-32">
                            <p className="text-slate-400 text-sm">{absence.user.name}</p>
                          </div>
                          <div className="flex-1 min-w-0">
                            {absence.notes && (
                              <p className="text-slate-500 text-xs truncate">{absence.notes}</p>
                            )}
                          </div>
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteAbsence(absence.id)}
                              className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all p-1 flex-shrink-0">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Task creation modal */}
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

      {/* Absence creation modal */}
      {showAbsenceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-white font-semibold text-lg mb-5">Ajouter une absence</h2>
            <form onSubmit={handleCreateAbsence} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Collaborateur *</label>
                <select required value={absenceForm.userId} onChange={e => setAbsenceForm({ ...absenceForm, userId: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                  <option value="">Sélectionner un collaborateur</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Date de début *</label>
                  <input type="date" required value={absenceForm.date} onChange={e => setAbsenceForm({ ...absenceForm, date: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Date de fin</label>
                  <input type="date" value={absenceForm.endDate} onChange={e => setAbsenceForm({ ...absenceForm, endDate: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Type *</label>
                  <select required value={absenceForm.type} onChange={e => setAbsenceForm({ ...absenceForm, type: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                    <option value="CONGE">Congé payé</option>
                    <option value="RTT">RTT</option>
                    <option value="MALADIE">Maladie</option>
                    <option value="FORMATION">Formation</option>
                    <option value="AUTRE">Autre</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Durée (jours) *</label>
                  <input
                    type="number"
                    required
                    min="0.5"
                    step="0.5"
                    value={absenceForm.duration}
                    onChange={e => setAbsenceForm({ ...absenceForm, duration: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Notes</label>
                <textarea value={absenceForm.notes} onChange={e => setAbsenceForm({ ...absenceForm, notes: e.target.value })} rows={2}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAbsenceModal(false)}
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
