'use client'

import { useEffect, useState, useRef } from 'react'
import { Plus, GripVertical, Circle, CheckCircle2, Clock, RotateCcw, Trash2, ChevronLeft, ChevronRight, ChevronDown, X, Check } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { useSession } from 'next-auth/react'
import { usePolling } from '@/hooks/usePolling'

interface SubTask {
  id: string
  title: string
  done: boolean
  position: number
}

interface AyshaTask {
  id: string
  title: string
  status: string
  priority: string
  dueDate?: string
  recurring: boolean
  recurrenceType?: string
  position: number
  subtasks?: SubTask[]
}

interface Absence {
  id: string
  date: string
  endDate?: string
  type: 'CONGES_PAYES' | 'RTT' | 'MALADIE' | 'FORMATION' | 'AUTRE'
  duration: number
  notes?: string
  user: { id: string; name: string }
}

interface User {
  id: string
  name: string
  role: string
}

const ABSENCE_TYPE_LABELS: Record<string, string> = {
  CONGES_PAYES: 'Vacances',
  MALADIE: 'Maladie',
}

const ABSENCE_TYPE_COLORS: Record<string, string> = {
  CONGES_PAYES: 'bg-blue-500/20 text-blue-400',
  MALADIE: 'bg-red-500/20 text-red-400',
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

  // Tasks state (Aysha-specific)
  const [tasks, setTasks] = useState<AyshaTask[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    title: '', status: 'TODO', priority: 'HIGH',
    dueDate: '', recurring: false, recurrenceType: 'Semaine',
    subtasks: [] as string[],
  })
  const [subtaskInput, setSubtaskInput] = useState('')
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const [subtaskInlineInputs, setSubtaskInlineInputs] = useState<Record<string, string>>({})
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [editingSubId, setEditingSubId] = useState<string | null>(null)
  const [editingSubTitle, setEditingSubTitle] = useState('')
  const dragItem = useRef<number | null>(null)
  const dragOver = useRef<number | null>(null)

  // Absences state
  const [absences, setAbsences] = useState<Absence[]>([])
  const [absencesLoading, setAbsencesLoading] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [showAbsenceModal, setShowAbsenceModal] = useState(false)
  const [filterMonth, setFilterMonth] = useState('')
  const [absenceForm, setAbsenceForm] = useState({
    date: '',
    endDate: '',
    type: 'CONGES_PAYES',
  })

  const isAdmin = (session?.user as { role?: string })?.role === 'ADMIN'

  useEffect(() => {
    fetch('/api/aysha-tasks').then(r => r.json()).then(t => {
      const taskArr = Array.isArray(t) ? t : []
      taskArr.sort((a: AyshaTask, b: AyshaTask) => a.position - b.position)
      setTasks(taskArr)
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (activeTab === 'absences') {
      fetchAbsences()
      fetch('/api/users').then(r => r.json()).then(setUsers).catch(() => {})
    }
  }, [activeTab])

  function refreshData() {
    fetch('/api/aysha-tasks').then(r => r.json()).then(t => {
      const taskArr = Array.isArray(t) ? t : []
      taskArr.sort((a: AyshaTask, b: AyshaTask) => a.position - b.position)
      setTasks(taskArr)
    }).catch(() => {})
    fetch('/api/absences').then(r => r.json()).then(setAbsences).catch(() => {})
    fetch('/api/users').then(r => r.json()).then(setUsers).catch(() => {})
  }

  usePolling(refreshData)

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
    try {
      let duration = 1
      if (absenceForm.endDate && absenceForm.date) {
        const start = new Date(absenceForm.date)
        const end = new Date(absenceForm.endDate)
        duration = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1)
      }
      const res = await fetch('/api/absences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: absenceForm.date,
          endDate: absenceForm.endDate || null,
          type: absenceForm.type,
          duration,
        }),
      })
      if (!res.ok) { alert('Erreur: ' + (await res.text())); return }
      const created = await res.json()
      setAbsences(prev => [created, ...prev])
      setShowAbsenceModal(false)
      setAbsenceForm({ date: '', endDate: '', type: 'CONGES_PAYES' })
    } catch (err) { alert('Erreur: ' + err) }
  }

  const activeTasks = tasks
  const doneTasks = tasks.filter(t => t.status === 'DONE')

  async function cycleStatus(task: AyshaTask) {
    const newStatus = STATUS_CYCLE[task.status]
    await fetch(`/api/aysha-tasks/${task.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    })
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
  }

  async function validateTask(task: AyshaTask) {
    await fetch(`/api/aysha-tasks/${task.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'DONE' })
    })
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'DONE' } : t))
  }

  async function deleteTask(id: string) {
    await fetch(`/api/aysha-tasks/${id}`, { method: 'DELETE' })
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  function startRename(task: AyshaTask) {
    setEditingTaskId(task.id)
    setEditingTitle(task.title)
  }

  async function commitRename() {
    if (!editingTaskId) return
    const trimmed = editingTitle.trim()
    if (!trimmed) { setEditingTaskId(null); return }
    await fetch(`/api/aysha-tasks/${editingTaskId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: trimmed })
    })
    setTasks(prev => prev.map(t => t.id === editingTaskId ? { ...t, title: trimmed } : t))
    setEditingTaskId(null)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/aysha-tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title,
        status: form.status,
        priority: form.priority,
        dueDate: form.dueDate || null,
        recurring: form.recurring,
        recurrenceType: form.recurring ? form.recurrenceType : null,
        position: tasks.length,
        subtasks: form.subtasks.filter(s => s.trim()),
      })
    })
    const task = await res.json()
    setTasks(prev => [...prev, task])
    setShowModal(false)
    setSubtaskInput('')
    setForm({ title: '', status: 'TODO', priority: 'HIGH', dueDate: '', recurring: false, recurrenceType: 'Semaine', subtasks: [] })
  }

  function toggleExpand(taskId: string) {
    setExpandedTasks(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  async function toggleSubtaskDone(taskId: string, sub: SubTask) {
    const newDone = !sub.done
    await fetch(`/api/aysha-tasks/${taskId}/subtasks/${sub.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: newDone })
    })
    setTasks(prev => prev.map(t => t.id === taskId ? {
      ...t,
      subtasks: t.subtasks?.map(s => s.id === sub.id ? { ...s, done: newDone } : s)
    } : t))
  }

  async function deleteSubtask(taskId: string, subId: string) {
    await fetch(`/api/aysha-tasks/${taskId}/subtasks/${subId}`, { method: 'DELETE' })
    setTasks(prev => prev.map(t => t.id === taskId ? {
      ...t,
      subtasks: t.subtasks?.filter(s => s.id !== subId)
    } : t))
  }

  function startSubRename(sub: SubTask) {
    setEditingSubId(sub.id)
    setEditingSubTitle(sub.title)
  }

  async function commitSubRename(taskId: string) {
    if (!editingSubId) return
    const trimmed = editingSubTitle.trim()
    if (!trimmed) { setEditingSubId(null); return }
    await fetch(`/api/aysha-tasks/${taskId}/subtasks/${editingSubId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: trimmed })
    })
    setTasks(prev => prev.map(t => t.id === taskId ? {
      ...t,
      subtasks: t.subtasks?.map(s => s.id === editingSubId ? { ...s, title: trimmed } : s)
    } : t))
    setEditingSubId(null)
  }

  async function addSubtaskInline(taskId: string) {
    const title = subtaskInlineInputs[taskId]?.trim()
    if (!title) return
    const res = await fetch(`/api/aysha-tasks/${taskId}/subtasks`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    })
    const sub = await res.json()
    setTasks(prev => prev.map(t => t.id === taskId ? {
      ...t,
      subtasks: [...(t.subtasks || []), sub]
    } : t))
    setSubtaskInlineInputs(prev => ({ ...prev, [taskId]: '' }))
  }

  function handleDragStart(idx: number) { dragItem.current = idx }
  function handleDragEnter(idx: number) { dragOver.current = idx }

  async function handleDrop() {
    if (dragItem.current === null || dragOver.current === null || dragItem.current === dragOver.current) {
      dragItem.current = null
      dragOver.current = null
      return
    }
    const items = [...activeTasks]
    const dragged = items.splice(dragItem.current, 1)[0]
    items.splice(dragOver.current, 0, dragged)
    const updated = items.map((t, i) => ({ ...t, position: i }))
    setTasks(prev => {
      const ids = new Set(updated.map(t => t.id))
      return [...prev.filter(t => !ids.has(t.id)), ...updated]
    })
    for (const t of updated) {
      fetch(`/api/aysha-tasks/${t.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: t.position })
      })
    }
    dragItem.current = null
    dragOver.current = null
  }

  // Default to current month if no filter set
  const currentMonthKey = filterMonth || (() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })()

  const filteredAbsences = absences.filter(a => {
    const d = new Date(a.date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return key === currentMonthKey
  })

  const filteredTotalDays = filteredAbsences.reduce((sum, a) => sum + a.duration, 0)

  function navigateMonth(direction: -1 | 1) {
    const [y, m] = currentMonthKey.split('-').map(Number)
    const d = new Date(y, m - 1 + direction, 1)
    setFilterMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Aysha</h1>
          {activeTab === 'tasks' && (
            <p className="text-slate-400 text-sm mt-1">
              {activeTasks.length} tâche{activeTasks.length > 1 ? 's' : ''} en cours · {doneTasks.length} terminée{doneTasks.length > 1 ? 's' : ''}
            </p>
          )}
          {activeTab === 'absences' && (
            <p className="text-slate-400 text-sm mt-1">
              {absences.length} absence{absences.length > 1 ? 's' : ''} enregistrée{absences.length > 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div className="flex gap-3">
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
              {activeTasks.length === 0 && (
                <div className="text-center py-16">
                  <p className="text-slate-500">Aucune tâche en cours</p>
                  <p className="text-slate-600 text-sm mt-1">Cliquez sur &quot;Nouvelle tâche&quot; pour commencer</p>
                </div>
              )}
              {activeTasks.map((task, idx) => {
                const subs = task.subtasks || []
                const doneCount = subs.filter(s => s.done).length
                const isExpanded = expandedTasks.has(task.id)
                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragEnter={() => handleDragEnter(idx)}
                    onDragEnd={handleDrop}
                    onDragOver={e => e.preventDefault()}
                  >
                    <div
                      className={`${task.status === 'DONE' ? 'bg-[#111118]/60 opacity-60' : 'bg-[#111118]'} border border-slate-800 ${isExpanded ? 'rounded-t-2xl border-b-0' : 'rounded-2xl'} p-4 flex items-center gap-3 group hover:border-slate-700 transition-colors cursor-grab active:cursor-grabbing active:opacity-70`}>
                      <GripVertical size={16} className="text-slate-700 group-hover:text-slate-500 flex-shrink-0 transition-colors" />
                      <button onClick={() => task.status === 'DONE' ? cycleStatus(task) : validateTask(task)} className="flex-shrink-0">
                        {task.status === 'DONE'
                          ? <CheckCircle2 size={18} className="text-green-400" />
                          : <Circle size={18} className={`${STATUS_COLORS[task.status]} hover:text-green-400 transition-colors`} />
                        }
                      </button>
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        {editingTaskId === task.id ? (
                          <input
                            autoFocus
                            value={editingTitle}
                            onChange={e => setEditingTitle(e.target.value)}
                            onBlur={commitRename}
                            onKeyDown={e => {
                              if (e.key === 'Enter') commitRename()
                              if (e.key === 'Escape') setEditingTaskId(null)
                            }}
                            className="text-sm font-medium text-white bg-transparent border-b border-[#E14B89] outline-none w-full py-0.5"
                          />
                        ) : (
                          <p
                            onDoubleClick={() => startRename(task)}
                            className={`text-sm font-medium cursor-text ${task.status === 'DONE' ? 'line-through text-slate-500' : 'text-white'}`}>
                            {task.title}
                          </p>
                        )}
                        <button onClick={() => toggleExpand(task.id)}
                          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors flex-shrink-0">
                          {subs.length > 0 ? <span>{doneCount}/{subs.length}</span> : <Plus size={10} />}
                          <ChevronDown size={12} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {task.recurring ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[#E14B89]/10 text-[#E14B89] flex items-center gap-1">
                            <RotateCcw size={10} />{task.recurrenceType ?? 'Récurrent'}
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400">One Shot</span>
                        )}
                        {task.dueDate && (
                          <span className="text-slate-500 text-xs flex items-center gap-1">
                            <Clock size={11} />{formatDate(task.dueDate)}
                          </span>
                        )}
                        {task.status !== 'DONE' && (
                          <button onClick={() => validateTask(task)} title="Valider"
                            className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-green-400 transition-all p-1">
                            <Check size={14} />
                          </button>
                        )}
                        <button onClick={() => deleteTask(task.id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all p-1">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Subtasks expandable */}
                    {isExpanded && (
                      <div className="bg-[#0d0d14] border border-slate-800 border-t-0 rounded-b-2xl px-4 pb-3 pt-1">
                        {subs.map(sub => (
                          <div key={sub.id} className="flex items-center gap-2.5 py-1.5 group/sub">
                            <button onClick={() => toggleSubtaskDone(task.id, sub)} className="flex-shrink-0">
                              {sub.done
                                ? <CheckCircle2 size={14} className="text-green-400" />
                                : <Circle size={14} className="text-slate-600 hover:text-[#E14B89] transition-colors" />
                              }
                            </button>
                            {editingSubId === sub.id ? (
                              <input
                                autoFocus
                                value={editingSubTitle}
                                onChange={e => setEditingSubTitle(e.target.value)}
                                onBlur={() => commitSubRename(task.id)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') commitSubRename(task.id)
                                  if (e.key === 'Escape') setEditingSubId(null)
                                }}
                                className="text-xs flex-1 bg-transparent border-b border-[#E14B89] outline-none text-white py-0.5"
                              />
                            ) : (
                              <span
                                onDoubleClick={() => startSubRename(sub)}
                                className={`text-xs flex-1 cursor-text ${sub.done ? 'line-through text-slate-600' : 'text-slate-300'}`}>
                                {sub.title}
                              </span>
                            )}
                            <button onClick={() => deleteSubtask(task.id, sub.id)}
                              className="opacity-0 group-hover/sub:opacity-100 text-slate-700 hover:text-red-400 transition-all p-0.5">
                              <Trash2 size={11} />
                            </button>
                          </div>
                        ))}
                        {/* Inline add subtask */}
                        <div className="flex items-center gap-2 mt-1.5">
                          <input
                            value={subtaskInlineInputs[task.id] || ''}
                            onChange={e => setSubtaskInlineInputs(prev => ({ ...prev, [task.id]: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSubtaskInline(task.id) } }}
                            placeholder="Ajouter une sous-tâche..."
                            className="flex-1 bg-transparent border-b border-slate-800 text-xs text-white py-1 px-1 focus:outline-none focus:border-[#E14B89] transition-colors placeholder:text-slate-700"
                          />
                          <button onClick={() => addSubtaskInline(task.id)}
                            className="text-slate-600 hover:text-[#E14B89] transition-colors p-0.5">
                            <Plus size={13} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

            </div>
          )}
        </>
      )}

      {/* Absences Tab */}
      {activeTab === 'absences' && (
        <>
          {absencesLoading ? (
            <div className="text-slate-500 text-sm">Chargement...</div>
          ) : (
            <>
              {/* Month navigator */}
              <div className="flex items-center justify-between mb-5">
                <button onClick={() => navigateMonth(-1)}
                  className="w-8 h-8 rounded-lg bg-[#111118] border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:border-slate-700 transition-colors">
                  <ChevronLeft size={16} />
                </button>
                <div className="text-center">
                  <h3 className="text-white font-semibold">{formatMonthLabel(currentMonthKey)}</h3>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {filteredAbsences.length} absence{filteredAbsences.length > 1 ? 's' : ''} · {filteredTotalDays} jour{filteredTotalDays > 1 ? 's' : ''}
                  </p>
                </div>
                <button onClick={() => navigateMonth(1)}
                  className="w-8 h-8 rounded-lg bg-[#111118] border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:border-slate-700 transition-colors">
                  <ChevronRight size={16} />
                </button>
              </div>

              {filteredAbsences.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-slate-500">Aucune absence ce mois-ci</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredAbsences.map(absence => (
                    <div key={absence.id}
                      className="bg-[#111118] border border-slate-800 rounded-2xl px-4 py-3 flex items-center gap-4 group hover:border-slate-700 transition-colors">
                      <div className="flex-shrink-0">
                        <p className="text-white text-sm">{formatAbsenceDate(absence.date, absence.endDate)}</p>
                      </div>
                      <div className="flex-shrink-0">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${ABSENCE_TYPE_COLORS[absence.type] ?? 'bg-slate-500/20 text-slate-400'}`}>
                          {ABSENCE_TYPE_LABELS[absence.type] ?? absence.type}
                        </span>
                      </div>
                      <div className="flex-1" />
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
              )}
            </>
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
                <label className="block text-slate-400 text-xs mb-1.5">Échéance</label>
                <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
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

              {/* Sous-tâches */}
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Sous-tâches</label>
                {form.subtasks.length > 0 && (
                  <div className="space-y-1 mb-2">
                    {form.subtasks.map((st, i) => (
                      <div key={i} className="flex items-center gap-2 bg-[#0d0d14] rounded-lg px-3 py-1.5">
                        <Circle size={12} className="text-slate-600 flex-shrink-0" />
                        <span className="text-white text-xs flex-1">{st}</span>
                        <button type="button" onClick={() => setForm({ ...form, subtasks: form.subtasks.filter((_, j) => j !== i) })}
                          className="text-slate-600 hover:text-red-400 transition-colors">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    value={subtaskInput}
                    onChange={e => setSubtaskInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && subtaskInput.trim()) {
                        e.preventDefault()
                        setForm({ ...form, subtasks: [...form.subtasks, subtaskInput.trim()] })
                        setSubtaskInput('')
                      }
                    }}
                    placeholder="Ajouter une sous-tâche..."
                    className="flex-1 bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#E14B89] transition-colors"
                  />
                  <button type="button" onClick={() => {
                    if (subtaskInput.trim()) {
                      setForm({ ...form, subtasks: [...form.subtasks, subtaskInput.trim()] })
                      setSubtaskInput('')
                    }
                  }} className="w-9 h-9 flex items-center justify-center bg-[#1a1a24] border border-slate-700 rounded-xl text-slate-400 hover:text-[#E14B89] hover:border-[#E14B89] transition-colors">
                    <Plus size={14} />
                  </button>
                </div>
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
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Type *</label>
                <select required value={absenceForm.type} onChange={e => setAbsenceForm({ ...absenceForm, type: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                  <option value="CONGES_PAYES">Vacances</option>
                  <option value="MALADIE">Maladie</option>
                  <option value="RTT">RTT</option>
                  <option value="SANS_SOLDE">Sans solde</option>
                  <option value="TELETRAVAIL">Télétravail</option>
                  <option value="AUTRE">Autre</option>
                </select>
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
