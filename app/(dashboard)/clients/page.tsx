'use client'

import { useEffect, useState, useRef } from 'react'
import { Plus, Search, Globe, Mail, Phone, ChevronRight, Upload, CheckCircle2, XCircle, Loader2, Trash2, Pencil, Building2, MapPin, X } from 'lucide-react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { formatPhone } from '@/lib/utils'

interface Client {
  id: string
  name: string
  email?: string
  phone?: string
  company?: string
  website?: string
  country?: string
  maintenancePlan: string
  maintenancePrice?: number
  projects: { id: string }[]
}

interface ImportResult {
  name: string
  success: boolean
  error?: string
}

const COUNTRIES = ['France', 'Luxembourg', 'Belgique', 'Suisse', 'Allemagne', 'Espagne', 'Italie', 'Royaume-Uni', 'Pays-Bas', 'Portugal', 'Canada', 'États-Unis', 'Autre']

export default function ClientsPage() {
  const { data: session } = useSession()
  const isAdmin = (session?.user as { role?: string })?.role === 'ADMIN'

  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResults, setImportResults] = useState<ImportResult[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [createError, setCreateError] = useState('')
  const [form, setForm] = useState({
    company: '', siret: '', address: '', postalCode: '', city: '', country: 'France',
    firstName: '', lastName: '', email: '', phone: '',
    contact2Name: '', contact2Email: '', contact2Phone: '',
    website: '', notes: '',
    maintenancePlan: 'NONE', maintenancePrice: '',
  })
  const [showContact2, setShowContact2] = useState(false)
  const [siretLoading, setSiretLoading] = useState(false)
  const importFileRef = useRef<HTMLInputElement>(null)

  const [deleteModal, setDeleteModal] = useState<{ client: Client; step: 1 | 2 } | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  const [editModal, setEditModal] = useState<Client | null>(null)
  const [editForm, setEditForm] = useState({
    name: '', email: '', phone: '', company: '', website: '', country: 'France',
    maintenancePlan: 'NONE', maintenancePrice: '',
  })
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(setClients).finally(() => setLoading(false))
  }, [])

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.company?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  )

  async function handleSiretSearch() {
    const siret = (form.siret || '').replace(/\s/g, '')
    if (siret.length < 9) return
    setSiretLoading(true)
    try {
      const res = await fetch(`/api/siret?siret=${siret}`)
      if (res.ok) {
        const data = await res.json()
        setForm(prev => ({
          ...prev,
          company: data.company || prev.company,
          address: data.address || prev.address,
          postalCode: data.postalCode || prev.postalCode,
          city: data.city || prev.city,
          siret: data.siret || prev.siret,
        }))
      } else {
        const err = await res.json()
        setCreateError(err.error || 'SIRET non trouvé')
        setTimeout(() => setCreateError(''), 3000)
      }
    } catch {
      setCreateError('Erreur de recherche SIRET')
      setTimeout(() => setCreateError(''), 3000)
    } finally {
      setSiretLoading(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setCreateError('')
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${form.firstName.trim()} ${form.lastName.trim()}`.trim() || form.company.trim(),
          company: form.company || null,
          siret: form.siret || null,
          email: form.email || null,
          phone: form.phone || null,
          address: form.address || null,
          postalCode: form.postalCode || null,
          city: form.city || null,
          country: form.country || 'France',
          website: form.website || null,
          notes: form.notes || null,
          contact2Name: form.contact2Name || null,
          contact2Email: form.contact2Email || null,
          contact2Phone: form.contact2Phone || null,
          maintenancePrice: form.maintenancePrice ? parseFloat(form.maintenancePrice) : null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        setCreateError(err.error || 'Erreur lors de la création')
        return
      }
      const client = await res.json()
      setClients(prev => [client, ...prev])
      setShowModal(false)
      setForm({
        company: '', siret: '', address: '', postalCode: '', city: '', country: 'France',
        firstName: '', lastName: '', email: '', phone: '',
        contact2Name: '', contact2Email: '', contact2Phone: '',
        website: '', notes: '',
        maintenancePlan: 'NONE', maintenancePrice: '',
      })
      setShowContact2(false)
    } finally {
      setSubmitting(false)
    }
  }

  function handleImportClick() {
    setImportResults([])
    importFileRef.current?.click()
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setShowImportModal(true)
    setImportResults([])

    const XLSX = await import('xlsx')
    const data = await file.arrayBuffer()
    const workbook = XLSX.read(data, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' })

    const results: ImportResult[] = []
    for (const row of rows) {
      const name = row['Nom'] || row['Name'] || row['nom'] || row['CLIENT'] || row['client'] || Object.values(row)[0]
      if (!name || typeof name !== 'string' || !name.trim()) continue

      const clientData = {
        name: name.trim(),
        company: (row['Entreprise'] || row['Company'] || row['Société'] || row['société'] || '').trim() || undefined,
        email: (row['Email'] || row['email'] || row['E-mail'] || '').trim() || undefined,
        phone: (row['Téléphone'] || row['Tel'] || row['Phone'] || row['téléphone'] || '').trim() || undefined,
        website: (row['Site'] || row['Website'] || row['URL'] || row['site'] || '').trim() || undefined,
      }

      try {
        const res = await fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(clientData),
        })
        if (res.ok) {
          const created = await res.json()
          setClients(prev => [...prev, created])
          results.push({ name: clientData.name, success: true })
        } else {
          const err = await res.json()
          results.push({ name: clientData.name, success: false, error: err.error || 'Erreur' })
        }
      } catch {
        results.push({ name: clientData.name, success: false, error: 'Erreur réseau' })
      }
      setImportResults([...results])
    }

    setImporting(false)
    if (importFileRef.current) importFileRef.current.value = ''
  }

  function openDeleteModal(client: Client) {
    setDeleteModal({ client, step: 1 })
    setDeleteConfirmText('')
  }

  function closeDeleteModal() {
    setDeleteModal(null)
    setDeleteConfirmText('')
  }

  function advanceDeleteStep() {
    if (!deleteModal) return
    setDeleteModal({ ...deleteModal, step: 2 })
    setDeleteConfirmText('')
  }

  async function handleDelete() {
    if (!deleteModal) return
    setDeleting(true)
    try {
      await fetch(`/api/clients/${deleteModal.client.id}`, { method: 'DELETE' })
      setClients(prev => prev.filter(c => c.id !== deleteModal.client.id))
      closeDeleteModal()
    } finally {
      setDeleting(false)
    }
  }

  function openEditModal(client: Client) {
    setEditModal(client)
    setEditForm({
      name: client.name,
      email: client.email ?? '',
      phone: client.phone ?? '',
      company: client.company ?? '',
      website: client.website ?? '',
      country: client.country ?? 'France',
      maintenancePlan: client.maintenancePlan,
      maintenancePrice: client.maintenancePrice?.toString() ?? '',
    })
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editModal || updating) return
    setUpdating(true)
    try {
      const res = await fetch(`/api/clients/${editModal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          maintenancePrice: editForm.maintenancePrice ? parseFloat(editForm.maintenancePrice) : null,
        }),
      })
      const updated = await res.json()
      setClients(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c))
      setEditModal(null)
    } finally {
      setUpdating(false)
    }
  }

  const inputClass = "w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Clients</h1>
          <p className="text-slate-400 text-sm mt-1">{clients.length} client{clients.length > 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleImportClick}
            className="flex items-center gap-2 border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            <Upload size={16} />
            Importer
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Nouveau client
          </button>
        </div>
      </div>

      <input
        ref={importFileRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleImportFile}
      />

      <div className="relative mb-6">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un client..."
          className="w-full max-w-sm bg-[#111118] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#E14B89] transition-colors"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-pulse">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-slate-800 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-800 rounded-lg w-3/4" />
                  <div className="h-3 bg-slate-800 rounded-lg w-1/2" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-slate-800 rounded-lg w-full" />
                <div className="h-3 bg-slate-800 rounded-lg w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {filtered.map(client => (
            <div key={client.id} className="relative group">
              <Link
                href={`/clients/${client.id}`}
                className="block bg-[#111118] border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-700/20 border border-[#E14B89]/20 flex items-center justify-center">
                    <span className="text-[#E14B89] font-semibold text-sm">{(client.company || client.name)[0].toUpperCase()}</span>
                  </div>
                  {!isAdmin && (
                    <ChevronRight size={16} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
                  )}
                </div>
                <h3 className="text-white font-medium">{client.company || client.name}</h3>
                {client.company && <p className="text-slate-400 text-sm mt-0.5">{client.name}</p>}
                <div className="mt-3 space-y-1.5">
                  {client.email && (
                    <div className="flex items-center gap-2 text-slate-500 text-xs">
                      <Mail size={12} /><span className="truncate">{client.email}</span>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-2 text-slate-500 text-xs">
                      <Phone size={12} /><span>{client.phone}</span>
                    </div>
                  )}
                  {client.website && (
                    <div className="flex items-center gap-2 text-slate-500 text-xs">
                      <Globe size={12} /><span className="truncate">{client.website}</span>
                    </div>
                  )}
                </div>
                <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-slate-500 text-xs">{client.projects.length} projet{client.projects.length > 1 ? 's' : ''}</span>
                  {client.country && client.country !== 'France' && (
                    <span className="text-slate-600 text-[10px] flex items-center gap-1"><MapPin size={10} />{client.country}</span>
                  )}
                </div>
              </Link>
              {isAdmin && (
                <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEditModal(client) }}
                    className="text-slate-600 hover:text-[#E14B89] p-1 rounded-lg hover:bg-[#E14B89]/10 transition-all"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); openDeleteModal(client) }}
                    className="text-slate-600 hover:text-red-400 p-1 rounded-lg hover:bg-red-400/10 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && !loading && (
            <div className="col-span-3 text-center py-16 text-slate-500">Aucun client trouvé</div>
          )}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-md">
            {deleteModal.step === 1 ? (
              <>
                <h2 className="text-white font-semibold text-lg mb-3">Supprimer le client ?</h2>
                <p className="text-slate-400 text-sm mb-6">
                  Êtes-vous sûr de vouloir supprimer &ldquo;{deleteModal.client.name}&rdquo; ? Cette action est irréversible. Tous les projets associés à ce client seront également supprimés.
                </p>
                <div className="flex gap-3">
                  <button type="button" onClick={closeDeleteModal}
                    className="border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm flex-1 transition-colors">Annuler</button>
                  <button type="button" onClick={advanceDeleteStep}
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium flex-1 transition-colors">Oui, continuer</button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-white font-semibold text-lg mb-3">Confirmation finale</h2>
                <p className="text-slate-400 text-sm mb-4">Pour confirmer, tapez le nom du client ci-dessous :</p>
                <input type="text" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder={deleteModal.client.name} autoFocus
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-red-500 transition-colors mb-6" />
                <div className="flex gap-3">
                  <button type="button" onClick={closeDeleteModal}
                    className="border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm flex-1 transition-colors">Annuler</button>
                  <button type="button" onClick={handleDelete} disabled={deleteConfirmText !== deleteModal.client.name || deleting}
                    className="bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-medium flex-1 transition-colors">
                    {deleting ? 'Suppression...' : 'Supprimer définitivement'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Import results modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center gap-3 mb-5">
              {importing ? <Loader2 size={20} className="text-[#E14B89] animate-spin" /> : <CheckCircle2 size={20} className="text-green-400" />}
              <h2 className="text-white font-semibold text-lg">
                {importing ? 'Import en cours...' : `Import terminé — ${importResults.filter(r => r.success).length}/${importResults.length} clients`}
              </h2>
            </div>
            {importResults.length > 0 && (
              <div className="overflow-y-auto flex-1 space-y-1.5 mb-5">
                {importResults.map((r, i) => (
                  <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#0d0d14]">
                    {r.success ? <CheckCircle2 size={14} className="text-green-400 flex-shrink-0" /> : <XCircle size={14} className="text-red-400 flex-shrink-0" />}
                    <span className="text-white text-sm flex-1 truncate">{r.name}</span>
                    {r.error && <span className="text-red-400 text-xs">{r.error}</span>}
                  </div>
                ))}
              </div>
            )}
            {!importing && (
              <button onClick={() => setShowImportModal(false)}
                className="w-full bg-[#E14B89] hover:opacity-90 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">Fermer</button>
            )}
            {importing && importResults.length === 0 && (
              <div className="text-slate-500 text-sm text-center py-4">Lecture du fichier...</div>
            )}
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-white font-semibold text-lg mb-5">Modifier le client</h2>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Nom *</label>
                  <input required value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Entreprise</label>
                  <input value={editForm.company} onChange={e => setEditForm({ ...editForm, company: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Email</label>
                  <input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Téléphone</label>
                  <input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: formatPhone(e.target.value) })} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Site web</label>
                  <input value={editForm.website} onChange={e => setEditForm({ ...editForm, website: e.target.value })} placeholder="https://" className={inputClass} />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Pays</label>
                  <select value={editForm.country} onChange={e => setEditForm({ ...editForm, country: e.target.value })} className={inputClass}>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Maintenance</label>
                  <select value={editForm.maintenancePlan} onChange={e => setEditForm({ ...editForm, maintenancePlan: e.target.value })} className={inputClass}>
                    <option value="NONE">Aucune</option>
                    <option value="HEBERGEMENT">Hébergement web</option>
                    <option value="CLASSIQUE">Classique (hébergement + mises à jour)</option>
                    <option value="CONTENU">Contenu (classique + contenu)</option>
                    <option value="SEO">SEO (contenu + SEO)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Prix mensuel (€)</label>
                  <input type="number" value={editForm.maintenancePrice} onChange={e => setEditForm({ ...editForm, maintenancePrice: e.target.value })} className={inputClass} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditModal(null)}
                  className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors">Annuler</button>
                <button type="submit" disabled={updating}
                  className="flex-1 bg-[#E14B89] hover:opacity-90 text-white py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-60">
                  {updating ? 'Sauvegarde...' : 'Sauvegarder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold text-lg">Nouveau client</h2>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-5">

              {/* ── Entreprise ── */}
              <div>
                <p className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Building2 size={12} className="text-[#E14B89]" /> Entreprise
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-400 text-xs mb-1.5">Recherche par SIRET</label>
                    <div className="flex gap-2">
                      <input value={form.siret} onChange={e => setForm({ ...form, siret: e.target.value })}
                        placeholder="Ex : 123 456 789 00012" className={`flex-1 ${inputClass}`} />
                      <button type="button" onClick={handleSiretSearch} disabled={siretLoading || (form.siret || '').replace(/\s/g, '').length < 9}
                        className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white px-4 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-1.5">
                        {siretLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                        Chercher
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-400 text-xs mb-1.5">Nom de l&apos;entreprise *</label>
                    <input required value={form.company} onChange={e => setForm({ ...form, company: e.target.value })}
                      placeholder="Ex : Kameo Agency" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-xs mb-1.5">Adresse</label>
                    <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                      placeholder="Rue, numéro..." className={inputClass} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">Code postal</label>
                      <input value={form.postalCode} onChange={e => setForm({ ...form, postalCode: e.target.value })}
                        placeholder="75002" className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">Ville</label>
                      <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
                        placeholder="Paris" className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">Pays</label>
                      <select value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} className={inputClass}>
                        {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Contact ── */}
              <div>
                <p className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Phone size={12} className="text-[#E14B89]" /> Contact
                </p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">Prénom</label>
                      <input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">Nom</label>
                      <input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} className={inputClass} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">Email</label>
                      <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">Téléphone</label>
                      <input value={form.phone} onChange={e => setForm({ ...form, phone: formatPhone(e.target.value) })} className={inputClass} />
                    </div>
                  </div>

                  {!showContact2 ? (
                    <button type="button" onClick={() => setShowContact2(true)}
                      className="text-[#E14B89] hover:text-[#F8903C] text-xs flex items-center gap-1 transition-colors">
                      <Plus size={12} /> Ajouter un second contact
                    </button>
                  ) : (
                    <div className="border border-slate-800 rounded-xl p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-xs font-medium">Contact secondaire</span>
                        <button type="button" onClick={() => { setShowContact2(false); setForm({ ...form, contact2Name: '', contact2Email: '', contact2Phone: '' }) }}
                          className="text-slate-600 hover:text-red-400 transition-colors"><XCircle size={14} /></button>
                      </div>
                      <div>
                        <label className="block text-slate-400 text-xs mb-1.5">Nom complet</label>
                        <input value={form.contact2Name} onChange={e => setForm({ ...form, contact2Name: e.target.value })} className={inputClass} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-400 text-xs mb-1.5">Email</label>
                          <input type="email" value={form.contact2Email} onChange={e => setForm({ ...form, contact2Email: e.target.value })} className={inputClass} />
                        </div>
                        <div>
                          <label className="block text-slate-400 text-xs mb-1.5">Téléphone</label>
                          <input value={form.contact2Phone} onChange={e => setForm({ ...form, contact2Phone: formatPhone(e.target.value) })} className={inputClass} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Autres ── */}
              <div className="space-y-3">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Site web</label>
                  <input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="https://" className={inputClass} />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Notes</label>
                  <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                    className={`${inputClass} resize-none`} />
                </div>
              </div>

              {createError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">{createError}</div>
              )}

              <div className="pt-2">
                <button type="submit" disabled={submitting}
                  className="w-full bg-[#E14B89] hover:opacity-90 text-white py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-60">
                  {submitting ? 'Création...' : 'Créer le client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
