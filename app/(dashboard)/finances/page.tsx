'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, DollarSign, Percent, Plus, Trash2, Pencil } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface Maintenance {
  id: string; clientName: string; type: string; priceHT?: number; active: boolean
}
interface Expense {
  id: string; name: string; amount: number; category: string; recurring: boolean; notes?: string
}
interface Project {
  id: string; name: string; status: string; price?: number; client: { name: string }
}

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  SALAIRE: 'Salaire', LOGICIEL: 'Logiciel', ABONNEMENT: 'Abonnement',
  ASSURANCE: 'Assurance', BANQUE: 'Banque', FOURNISSEUR: 'Fournisseur', AUTRE: 'Autre'
}
const EXPENSE_CATEGORY_COLORS: Record<string, string> = {
  SALAIRE: 'bg-[#E14B89]/10 text-[#E14B89]', LOGICIEL: 'bg-blue-400/10 text-blue-400',
  ABONNEMENT: 'bg-purple-400/10 text-purple-400', ASSURANCE: 'bg-orange-400/10 text-orange-400',
  BANQUE: 'bg-teal-400/10 text-teal-400', FOURNISSEUR: 'bg-amber-400/10 text-amber-400',
  AUTRE: 'bg-slate-400/10 text-slate-400'
}
const MAINTENANCE_TYPE_LABELS: Record<string, string> = {
  WEB: 'Maintenances Web', GOOGLE: 'Fiches Google', RESEAUX: 'Réseaux sociaux', BLOG: 'Blog'
}
const emptyForm = { name: '', amount: '', category: 'ABONNEMENT', recurring: true, notes: '' }

function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub?: string; icon: React.ElementType; color: string
}) {
  return (
    <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-slate-400 text-sm">{label}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={18} />
        </div>
      </div>
      <p className="text-2xl font-semibold text-white">{value}</p>
      {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
    </div>
  )
}

export default function FinancesPage() {
  const [maintenances, setMaintenances] = useState<Maintenance[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Expense | null>(null)
  const [form, setForm] = useState<Record<string, string | boolean>>(emptyForm)

  useEffect(() => {
    Promise.all([
      fetch('/api/maintenances').then(r => r.json()),
      fetch('/api/expenses').then(r => r.json()),
      fetch('/api/projects').then(r => r.json()),
    ]).then(([m, e, p]) => { setMaintenances(m); setExpenses(e); setProjects(p) })
    .finally(() => setLoading(false))
  }, [])

  // Compute income
  const maintenanceIncome = ['WEB', 'GOOGLE', 'RESEAUX', 'BLOG'].map(type => ({
    type, label: MAINTENANCE_TYPE_LABELS[type],
    total: maintenances.filter(m => m.type === type && m.active).reduce((s, m) => s + (m.priceHT ?? 0), 0)
  }))
  const signedProjects = projects.filter(p => p.status === 'LIVRAISON' || p.status === 'MAINTENANCE')
  const totalMaintenanceIncome = maintenanceIncome.reduce((s, m) => s + m.total, 0)
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const net = totalMaintenanceIncome - totalExpenses
  const margin = totalMaintenanceIncome > 0 ? Math.round((net / totalMaintenanceIncome) * 100) : 0

  function openModal(item?: Expense) {
    if (item) {
      setEditItem(item)
      setForm({ ...item, amount: item.amount.toString() })
    } else {
      setEditItem(null)
      setForm({ ...emptyForm })
    }
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = { ...form, amount: parseFloat(form.amount as string) }
    if (editItem) {
      const res = await fetch(`/api/expenses/${editItem.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      })
      const updated = await res.json()
      setExpenses(prev => prev.map(e => e.id === editItem.id ? updated : e))
    } else {
      const res = await fetch('/api/expenses', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      })
      const created = await res.json()
      setExpenses(prev => [...prev, created])
    }
    setShowModal(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette dépense ?')) return
    await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
    setExpenses(prev => prev.filter(e => e.id !== id))
  }

  // Group expenses by category
  const byCategory = Object.entries(
    expenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount
      return acc
    }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1])

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Finances</h1>
          <p className="text-slate-400 text-sm mt-1">Vue mensuelle des entrées et sorties</p>
        </div>
        <button onClick={() => openModal()}
          className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
          <Plus size={16} /> Ajouter une dépense
        </button>
      </div>

      {loading ? <div className="text-slate-500 text-sm">Chargement...</div> : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <KpiCard label="Entrées mensuelles" value={formatCurrency(totalMaintenanceIncome)}
              sub="Maintenances actives" icon={TrendingUp} color="bg-green-400/10 text-green-400" />
            <KpiCard label="Sorties mensuelles" value={formatCurrency(totalExpenses)}
              sub={`${expenses.length} postes de dépense`} icon={TrendingDown} color="bg-red-400/10 text-red-400" />
            <KpiCard label="Résultat net" value={formatCurrency(net)}
              sub={net >= 0 ? 'Bénéficiaire' : 'Déficitaire'} icon={DollarSign}
              color={net >= 0 ? 'bg-[#E14B89]/10 text-[#E14B89]' : 'bg-red-400/10 text-red-400'} />
            <KpiCard label="Marge" value={`${margin}%`}
              sub="Sur le CA maintenances" icon={Percent} color="bg-blue-400/10 text-blue-400" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Entrées */}
            <div>
              <h2 className="text-white font-semibold mb-4">Entrées</h2>
              <div className="bg-[#111118] border border-slate-800 rounded-2xl overflow-hidden mb-4">
                {maintenanceIncome.map((m, i) => (
                  <div key={m.type} className={`flex items-center justify-between px-5 py-4 ${i < maintenanceIncome.length - 1 ? 'border-b border-slate-800/60' : ''}`}>
                    <div>
                      <p className="text-white text-sm font-medium">{m.label}</p>
                      <p className="text-slate-500 text-xs">
                        {maintenances.filter(x => x.type === m.type && x.active).length} contrats actifs
                      </p>
                    </div>
                    <span className="text-green-400 font-semibold">{formatCurrency(m.total)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-5 py-4 border-t border-slate-700 bg-slate-800/30">
                  <span className="text-white font-semibold">Total entrées</span>
                  <span className="text-green-400 font-bold text-lg">{formatCurrency(totalMaintenanceIncome)}</span>
                </div>
              </div>

              {/* Category breakdown */}
              <h3 className="text-slate-400 text-sm font-medium mb-3">Répartition par type</h3>
              <div className="space-y-2">
                {byCategory.map(([cat, amount]) => {
                  const pct = totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0
                  return (
                    <div key={cat} className="bg-[#111118] border border-slate-800 rounded-xl px-4 py-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${EXPENSE_CATEGORY_COLORS[cat]}`}>
                          {EXPENSE_CATEGORY_LABELS[cat]}
                        </span>
                        <span className="text-white text-sm font-medium">{formatCurrency(amount)}</span>
                      </div>
                      <div className="w-full h-1 bg-slate-800 rounded-full">
                        <div className="h-full bg-[#E14B89] rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Sorties */}
            <div>
              <h2 className="text-white font-semibold mb-4">Sorties fixes</h2>
              <div className="bg-[#111118] border border-slate-800 rounded-2xl overflow-hidden">
                {expenses.length === 0 ? (
                  <div className="px-5 py-8 text-center text-slate-500 text-sm">Aucune dépense enregistrée</div>
                ) : (
                  <>
                    {expenses.map((expense, i) => (
                      <div key={expense.id}
                        className={`flex items-center gap-3 px-5 py-3.5 group hover:bg-slate-800/20 transition-colors ${i < expenses.length - 1 ? 'border-b border-slate-800/50' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-white text-sm">{expense.name}</p>
                            {expense.recurring && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-slate-800 text-slate-500">Fixe</span>
                            )}
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${EXPENSE_CATEGORY_COLORS[expense.category]}`}>
                            {EXPENSE_CATEGORY_LABELS[expense.category]}
                          </span>
                        </div>
                        <span className="text-red-400 font-medium text-sm">{formatCurrency(expense.amount)}</span>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openModal(expense)} className="p-1.5 text-slate-600 hover:text-white transition-colors">
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => handleDelete(expense.id)} className="p-1.5 text-slate-600 hover:text-red-400 transition-colors">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between px-5 py-4 border-t border-slate-700 bg-slate-800/30">
                      <span className="text-white font-semibold">Total sorties</span>
                      <span className="text-red-400 font-bold text-lg">{formatCurrency(totalExpenses)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-white font-semibold text-lg mb-5">{editItem ? 'Modifier la dépense' : 'Nouvelle dépense'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Nom *</label>
                <input required value={form.name as string} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Adobe Photoshop"
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Montant (€) *</label>
                  <input type="number" step="0.01" required value={form.amount as string} onChange={e => setForm({ ...form, amount: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Catégorie</label>
                  <select value={form.category as string} onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors">
                    {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="recurring" checked={form.recurring as boolean} onChange={e => setForm({ ...form, recurring: e.target.checked })}
                  className="accent-[#E14B89]" />
                <label htmlFor="recurring" className="text-slate-400 text-sm">Dépense récurrente (mensuelle)</label>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Notes</label>
                <input value={form.notes as string} onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors">Annuler</button>
                <button type="submit" className="flex-1 bg-[#E14B89] hover:opacity-90 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
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
