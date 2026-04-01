'use client'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Receipt, Check, Clock, X, TrendingUp, ArrowRight, Users, Scale } from 'lucide-react'
import { formatCurrency, formatDate, ROLE_AVATAR_COLORS } from '@/lib/utils'
import { useSession } from 'next-auth/react'
import { usePolling } from '@/hooks/usePolling'

interface ExpenseReport {
  id: string
  userId: string
  date: string
  amount: number
  description: string
  category: string
  status: string
  notes?: string
  user: { id: string; name: string; avatar?: string; role?: string }
}

interface Associate {
  id: string
  name: string
  avatar?: string
  role: string
}

interface Settlement {
  from: string
  to: string
  amount: number
}

const CATEGORY_LABELS: Record<string, string> = {
  TRANSPORT: 'Transport', REPAS: 'Repas', HEBERGEMENT: 'Hébergement',
  MATERIEL: 'Matériel', LOGICIEL: 'Logiciel', AUTRE: 'Autre',
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  EN_ATTENTE: { label: 'En attente', color: 'text-amber-400 bg-amber-400/10', icon: Clock },
  VALIDE:     { label: 'Validé',     color: 'text-green-400 bg-green-400/10',  icon: Check },
  REMBOURSE:  { label: 'Remboursé',  color: 'text-blue-400 bg-blue-400/10',   icon: Check },
  REFUSE:     { label: 'Refusé',     color: 'text-red-400 bg-red-400/10',     icon: X },
}

// Only count active (non-refused) expenses in the settlement
const ACTIVE_STATUSES = ['EN_ATTENTE', 'VALIDE', 'REMBOURSE']

const emptyForm = {
  date: new Date().toISOString().split('T')[0],
  amount: '', description: '', category: 'AUTRE', notes: '', userId: '',
}

// ── Settlement algorithm (minimum transactions) ─────────────────────────────
function calcSettlements(balances: { name: string; balance: number }[]): Settlement[] {
  const creditors = balances
    .filter(b => b.balance > 0.01)
    .map(b => ({ ...b }))
    .sort((a, b) => b.balance - a.balance)
  const debtors = balances
    .filter(b => b.balance < -0.01)
    .map(b => ({ ...b }))
    .sort((a, b) => a.balance - b.balance)

  const transactions: Settlement[] = []
  let i = 0
  let j = 0

  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(-debtors[i].balance, creditors[j].balance)
    if (amount > 0.01) {
      transactions.push({ from: debtors[i].name, to: creditors[j].name, amount })
    }
    debtors[i].balance += amount
    creditors[j].balance -= amount
    if (Math.abs(debtors[i].balance) < 0.01) i++
    if (Math.abs(creditors[j].balance) < 0.01) j++
  }

  return transactions
}

export default function NotesDefraisPage() {
  const { data: session } = useSession()
  const isAdmin = (session?.user as { role?: string })?.role === 'ADMIN'

  const [reports, setReports] = useState<ExpenseReport[]>([])
  const [associates, setAssociates] = useState<Associate[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'liste' | 'bilan'>('liste')

  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<ExpenseReport | null>(null)
  const [form, setForm] = useState<Record<string, string>>(emptyForm)
  const [filterUser, setFilterUser] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/expense-reports').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
    ]).then(([r, u]) => {
      setReports(Array.isArray(r) ? r : [])
      // Only keep ADMIN users as "associates"
      const admins: Associate[] = (Array.isArray(u) ? u : []).filter(
        (user: Associate) => user.role === 'ADMIN'
      )
      setAssociates(admins)
    }).finally(() => setLoading(false))
  }, [])

  function refreshData() {
    Promise.all([
      fetch('/api/expense-reports').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
    ]).then(([r, u]) => {
      setReports(Array.isArray(r) ? r : [])
      const admins: Associate[] = (Array.isArray(u) ? u : []).filter(
        (user: Associate) => user.role === 'ADMIN'
      )
      setAssociates(admins)
    })
  }
  usePolling(refreshData)

  // ── Filter list ────────────────────────────────────────────────────────────
  // Only show expenses belonging to admin users
  const adminIds = new Set(associates.map(a => a.id))
  const allAdminReports = reports.filter(r => adminIds.has(r.userId))

  const filtered = allAdminReports.filter(r => {
    const matchUser = !filterUser || r.userId === filterUser
    const matchStatus = !filterStatus || r.status === filterStatus
    return matchUser && matchStatus
  })

  // ── Bilan calculations ─────────────────────────────────────────────────────
  const activeReports = allAdminReports.filter(r => ACTIVE_STATUSES.includes(r.status))
  const totalActive = activeReports.reduce((s, r) => s + r.amount, 0)
  const fairShare = associates.length > 0 ? totalActive / associates.length : 0

  const perPerson = associates.map(a => {
    const paid = activeReports.filter(r => r.userId === a.id).reduce((s, r) => s + r.amount, 0)
    const balance = paid - fairShare // positive = owed money back, negative = owes
    return { id: a.id, name: a.name, avatar: a.avatar, paid, balance }
  })

  const settlements = calcSettlements(perPerson.map(p => ({ name: p.name, balance: p.balance })))

  // ── Modal helpers ──────────────────────────────────────────────────────────
  function openModal(item?: ExpenseReport) {
    if (item) {
      setEditItem(item)
      setForm({
        date: item.date.split('T')[0],
        amount: item.amount.toString(),
        description: item.description,
        category: item.category,
        notes: item.notes ?? '',
        userId: item.userId,
      })
    } else {
      setEditItem(null)
      setForm({ ...emptyForm, userId: session?.user?.id ?? '' })
    }
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = { ...form, amount: parseFloat(form.amount), notes: form.notes || null }
    if (editItem) {
      const res = await fetch(`/api/expense-reports/${editItem.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const updated = await res.json()
      setReports(prev => prev.map(r => r.id === editItem.id ? updated : r))
    } else {
      const res = await fetch('/api/expense-reports', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const created = await res.json()
      setReports(prev => [created, ...prev])
    }
    setShowModal(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette note de frais ?')) return
    await fetch(`/api/expense-reports/${id}`, { method: 'DELETE' })
    setReports(prev => prev.filter(r => r.id !== id))
  }

  async function handleStatusChange(id: string, status: string) {
    const res = await fetch(`/api/expense-reports/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    })
    const updated = await res.json()
    setReports(prev => prev.map(r => r.id === id ? updated : r))
  }

  const totalPending = allAdminReports.filter(r => r.status === 'EN_ATTENTE').reduce((s, r) => s + r.amount, 0)

  // ── Avatar helper ──────────────────────────────────────────────────────────
  function Avatar({ user, size = 7 }: { user: { name: string; avatar?: string }; size?: number }) {
    const cls = `w-${size} h-${size} rounded-full`
    if (user.avatar) return <img src={user.avatar} alt={user.name} className={`${cls} object-cover`} />
    const gradient = ROLE_AVATAR_COLORS['ADMIN'] ?? 'from-[#E14B89] to-pink-700'
    return (
      <div className={`${cls} bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}>
        <span className="text-white text-xs font-semibold">{user.name[0]}</span>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-[#E14B89]/10 flex items-center justify-center">
              <Receipt size={18} className="text-[#E14B89]" />
            </div>
            <h1 className="text-2xl font-semibold text-white">Notes de frais</h1>
          </div>
          <p className="text-slate-400 text-sm mt-1 ml-12">
            {associates.length} associé{associates.length > 1 ? 's' : ''} ·{' '}
            {formatCurrency(totalPending)} en attente
          </p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Ajouter
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-[#111118] border border-slate-800 rounded-xl p-1 mb-6 w-fit">
        {([
          { key: 'liste', label: 'Liste des dépenses', icon: Receipt },
          { key: 'bilan', label: 'Bilan & Répartition', icon: Scale },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === tab.key ? 'bg-[#E14B89] text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-slate-500 text-sm">Chargement...</div>
      ) : activeTab === 'liste' ? (
        <>
          {/* Filters */}
          <div className="flex gap-3 mb-4 flex-wrap">
            <select
              value={filterUser}
              onChange={e => setFilterUser(e.target.value)}
              className="bg-[#111118] border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
            >
              <option value="">Tous les associés</option>
              {associates.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="bg-[#111118] border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
            >
              <option value="">Tous les statuts</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>

          {/* Table */}
          <div className="bg-[#111118] border border-slate-800 rounded-2xl overflow-hidden">
            {filtered.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-sm">Aucune note de frais</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium">Associé</th>
                    <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium">Description</th>
                    <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium hidden sm:table-cell">Catégorie</th>
                    <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium">Montant</th>
                    <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium hidden md:table-cell">Date</th>
                    <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium">Statut</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => {
                    const s = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.EN_ATTENTE
                    const Icon = s.icon
                    return (
                      <tr
                        key={r.id}
                        className={`border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors group ${i === filtered.length - 1 ? 'border-0' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Avatar user={r.user} size={7} />
                            <span className="text-white text-sm">{r.user.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-300 text-sm">{r.description}</td>
                        <td className="px-4 py-3 text-slate-400 text-sm hidden sm:table-cell">{CATEGORY_LABELS[r.category] ?? r.category}</td>
                        <td className="px-4 py-3 text-white text-sm font-medium">{formatCurrency(r.amount)}</td>
                        <td className="px-4 py-3 text-slate-400 text-sm hidden md:table-cell">{formatDate(r.date)}</td>
                        <td className="px-4 py-3">
                          {isAdmin ? (
                            <select
                              value={r.status}
                              onChange={e => handleStatusChange(r.id, e.target.value)}
                              className={`text-xs px-2 py-1 rounded-full border-0 cursor-pointer ${s.color} bg-transparent`}
                            >
                              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                                <option key={k} value={k} className="bg-[#111118] text-white">{v.label}</option>
                              ))}
                            </select>
                          ) : (
                            <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full w-fit ${s.color}`}>
                              <Icon size={10} />{s.label}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openModal(r)} className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-slate-800/50 transition-colors">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => handleDelete(r.id)} className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-400/5 transition-colors">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        /* ── Bilan tab ──────────────────────────────────────────────────────── */
        <div className="space-y-6">
          {/* Global stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-[#E14B89]/10 flex items-center justify-center">
                  <TrendingUp size={16} className="text-[#E14B89]" />
                </div>
                <p className="text-slate-400 text-xs">Total dépenses</p>
              </div>
              <p className="text-2xl font-bold text-white">{formatCurrency(totalActive)}</p>
              <p className="text-slate-500 text-xs mt-1">dépenses validées</p>
            </div>
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Users size={16} className="text-blue-400" />
                </div>
                <p className="text-slate-400 text-xs">Part par associé</p>
              </div>
              <p className="text-2xl font-bold text-blue-400">{formatCurrency(fairShare)}</p>
              <p className="text-slate-500 text-xs mt-1">répartition équitable</p>
            </div>
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Clock size={16} className="text-amber-400" />
                </div>
                <p className="text-slate-400 text-xs">En attente</p>
              </div>
              <p className="text-2xl font-bold text-amber-400">{formatCurrency(totalPending)}</p>
              <p className="text-slate-500 text-xs mt-1">à valider</p>
            </div>
          </div>

          {/* Per-person breakdown */}
          <div className="bg-[#111118] border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800">
              <h2 className="text-white font-semibold">Dépenses par associé</h2>
              <p className="text-slate-500 text-xs mt-0.5">Part équitable : {formatCurrency(fairShare)} chacun</p>
            </div>
            {associates.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">Aucun associé trouvé</div>
            ) : (
              <div className="divide-y divide-slate-800/50">
                {perPerson
                  .sort((a, b) => b.paid - a.paid)
                  .map(person => {
                    const isCreditor = person.balance > 0.01
                    const isDebtor = person.balance < -0.01
                    const pct = totalActive > 0 ? (person.paid / totalActive) * 100 : 0

                    return (
                      <div key={person.id} className="px-5 py-4 flex items-center gap-4">
                        {/* Avatar */}
                        <Avatar user={person} size={10} />

                        {/* Name + bar */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-white font-medium text-sm">{person.name}</p>
                            <p className="text-white font-semibold text-sm">{formatCurrency(person.paid)}</p>
                          </div>
                          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${pct}%`,
                                background: isCreditor
                                  ? 'linear-gradient(90deg, #10b981, #34d399)'
                                  : isDebtor
                                  ? 'linear-gradient(90deg, #f43f5e, #fb7185)'
                                  : 'linear-gradient(90deg, #6366f1, #818cf8)',
                              }}
                            />
                          </div>
                        </div>

                        {/* Balance badge */}
                        <div className="flex-shrink-0 min-w-[110px] text-right">
                          {isCreditor ? (
                            <div className="inline-flex flex-col items-end">
                              <span className="text-xs text-slate-500">doit recevoir</span>
                              <span className="text-emerald-400 font-semibold text-sm">+{formatCurrency(person.balance)}</span>
                            </div>
                          ) : isDebtor ? (
                            <div className="inline-flex flex-col items-end">
                              <span className="text-xs text-slate-500">doit payer</span>
                              <span className="text-rose-400 font-semibold text-sm">{formatCurrency(Math.abs(person.balance))}</span>
                            </div>
                          ) : (
                            <div className="inline-flex flex-col items-end">
                              <span className="text-xs text-slate-500">à l&apos;équilibre</span>
                              <span className="text-slate-400 font-semibold text-sm">0 €</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>

          {/* Settlements */}
          <div className="bg-[#111118] border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800">
              <h2 className="text-white font-semibold">Règlements à effectuer</h2>
              <p className="text-slate-500 text-xs mt-0.5">
                {settlements.length === 0
                  ? 'Tout est à l\'équilibre — aucun virement nécessaire'
                  : `${settlements.length} virement${settlements.length > 1 ? 's' : ''} pour solder les comptes`}
              </p>
            </div>

            {settlements.length === 0 ? (
              <div className="px-5 py-8 flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                  <Check size={22} className="text-emerald-400" />
                </div>
                <p className="text-emerald-400 font-medium">Comptes équilibrés</p>
                <p className="text-slate-500 text-sm">Aucun remboursement nécessaire entre les associés.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/50">
                {settlements.map((t, i) => (
                  <div key={i} className="px-5 py-4 flex items-center gap-4">
                    {/* From */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-rose-500/15 flex items-center justify-center flex-shrink-0">
                        <span className="text-rose-400 font-bold text-sm">{t.from[0]}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-sm font-medium truncate">{t.from}</p>
                        <p className="text-rose-400 text-xs">doit payer</p>
                      </div>
                    </div>

                    {/* Arrow + amount */}
                    <div className="flex flex-col items-center gap-1 flex-shrink-0">
                      <span className="text-white font-bold text-base">{formatCurrency(t.amount)}</span>
                      <ArrowRight size={16} className="text-[#E14B89]" />
                    </div>

                    {/* To */}
                    <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                      <div className="min-w-0 text-right">
                        <p className="text-white text-sm font-medium truncate">{t.to}</p>
                        <p className="text-emerald-400 text-xs">doit recevoir</p>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                        <span className="text-emerald-400 font-bold text-sm">{t.to[0]}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Note */}
          <p className="text-slate-600 text-xs text-center">
            Le bilan est calculé sur les dépenses en attente, validées et remboursées. Les dépenses refusées sont exclues.
          </p>
        </div>
      )}

      {/* ── Modal ─────────────────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center gap-2 mb-5">
              <Receipt size={18} className="text-[#E14B89]" />
              <h2 className="text-white font-semibold text-lg">
                {editItem ? 'Modifier la note' : 'Nouvelle note de frais'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Associé</label>
                <select
                  value={form.userId}
                  onChange={e => setForm({ ...form, userId: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                >
                  <option value="">Sélectionner un associé</option>
                  {associates.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Description *</label>
                <input
                  required
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Montant (€) *</label>
                  <input
                    type="number" step="0.01" min="0" required
                    value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Catégorie</label>
                  <select
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Date *</label>
                <input
                  type="date" required
                  value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#E14B89] hover:opacity-90 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                  {editItem ? 'Sauvegarder' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
