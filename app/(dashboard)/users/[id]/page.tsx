'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Mail, Calendar, FolderKanban, FileText, Euro, Clock } from 'lucide-react'
import { ROLE_LABELS, ROLE_COLORS, ROLE_AVATAR_COLORS, PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS, formatCurrency, formatDate } from '@/lib/utils'

const DONE_STATUSES = ['ARCHIVE', 'LIVRAISON', 'MAINTENANCE']
const ACTIVE_STATUSES = ['BRIEF', 'REDACTION', 'MAQUETTE', 'DEVELOPPEMENT', 'REVIEW']

interface Invoice {
  id: string; filename: string; fileUrl: string; amount?: number; createdAt: string
  project: { id: string; name: string; client: { name: string } }
}
interface Project {
  id: string; name: string; status: string
  client: { name: string }
  invoices: Invoice[]
}
interface UserDetail {
  id: string; name: string; email: string; role: string; avatar?: string
  lastSeen?: string; createdAt: string
  assignedProjects: Project[]
  invoicesUploaded: Invoice[]
}

function timeAgo(date?: string) {
  if (!date) return 'Jamais connecté'
  const diff = Date.now() - new Date(date).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'En ligne'
  if (min < 60) return `Il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `Il y a ${h}h`
  return `Il y a ${Math.floor(h / 24)}j`
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={15} />
        </div>
      </div>
      <p className="text-2xl font-semibold text-white">{value}</p>
      <p className="text-slate-400 text-xs mt-1">{label}</p>
    </div>
  )
}

export default function UserDetailPage() {
  const { id } = useParams()
  const [user, setUser] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/users/${id}`).then(r => r.json()).then(setUser).finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="p-8 text-slate-500">Chargement...</div>
  if (!user) return <div className="p-8 text-slate-500">Utilisateur introuvable</div>

  const gradient = ROLE_AVATAR_COLORS[user.role] ?? 'from-slate-400 to-slate-600'
  const doneProjects = user.assignedProjects.filter(p => DONE_STATUSES.includes(p.status))
  const activeProjects = user.assignedProjects.filter(p => ACTIVE_STATUSES.includes(p.status))
  const totalCA = user.invoicesUploaded.reduce((s, inv) => s + (inv.amount ?? 0), 0)
  const pendingInvoices = user.invoicesUploaded.filter(inv => !inv.amount)

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <Link href="/users" className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6 transition-colors">
        <ArrowLeft size={16} /> Retour aux utilisateurs
      </Link>

      {/* Header */}
      <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 mb-6 flex items-center gap-5">
        <div className="relative flex-shrink-0">
          {user.avatar ? (
            <img src={user.avatar} alt={user.name} className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
              <span className="text-white font-bold text-xl">{user.name[0]?.toUpperCase()}</span>
            </div>
          )}
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#111118] bg-slate-600" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-semibold text-white">{user.name}</h1>
            <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${ROLE_COLORS[user.role] ?? 'bg-slate-800 text-slate-400 border-slate-700'}`}>
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
          </div>
          <div className="flex items-center gap-4 text-slate-400 text-sm">
            <span className="flex items-center gap-1.5"><Mail size={13} />{user.email}</span>
            <span className="flex items-center gap-1.5"><Clock size={13} />{timeAgo(user.lastSeen)}</span>
            <span className="flex items-center gap-1.5"><Calendar size={13} />Depuis {formatDate(user.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Projets réalisés" value={doneProjects.length} icon={FolderKanban} color="bg-green-400/10 text-green-400" />
        <StatCard label="Projets en cours" value={activeProjects.length} icon={FolderKanban} color="bg-blue-400/10 text-blue-400" />
        <StatCard label="Factures déposées" value={user.invoicesUploaded.length} icon={FileText} color="bg-[#E14B89]/10 text-[#E14B89]" />
        <StatCard label="CA généré" value={formatCurrency(totalCA)} icon={Euro} color="bg-amber-400/10 text-amber-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Projects */}
        <div className="space-y-4">
          {activeProjects.length > 0 && (
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
              <h2 className="text-white font-medium mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                Projets en cours ({activeProjects.length})
              </h2>
              <div className="space-y-2">
                {activeProjects.map(p => (
                  <Link key={p.id} href={`/projects/${p.id}`}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-800/40 transition-colors group">
                    <div>
                      <p className="text-white text-sm font-medium group-hover:text-[#E14B89] transition-colors">{p.name}</p>
                      <p className="text-slate-500 text-xs">{p.client.name}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PROJECT_STATUS_COLORS[p.status]}`}>
                      {PROJECT_STATUS_LABELS[p.status]}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {doneProjects.length > 0 && (
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
              <h2 className="text-white font-medium mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                Projets réalisés ({doneProjects.length})
              </h2>
              <div className="space-y-2">
                {doneProjects.map(p => (
                  <Link key={p.id} href={`/projects/${p.id}`}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-800/40 transition-colors group">
                    <div>
                      <p className="text-slate-400 text-sm group-hover:text-white transition-colors">{p.name}</p>
                      <p className="text-slate-600 text-xs">{p.client.name}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PROJECT_STATUS_COLORS[p.status]}`}>
                      {PROJECT_STATUS_LABELS[p.status]}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {doneProjects.length === 0 && activeProjects.length === 0 && (
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
              <p className="text-slate-500 text-sm">Aucun projet assigné</p>
            </div>
          )}
        </div>

        {/* Invoices */}
        <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
          <h2 className="text-white font-medium mb-4 flex items-center gap-2">
            <FileText size={15} className="text-[#E14B89]" />
            Factures ({user.invoicesUploaded.length})
          </h2>
          {user.invoicesUploaded.length === 0 ? (
            <p className="text-slate-500 text-sm">Aucune facture déposée</p>
          ) : (
            <div className="space-y-2">
              {user.invoicesUploaded.map(inv => (
                <div key={inv.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800/30 transition-colors">
                  <FileText size={14} className="text-slate-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <a href={inv.fileUrl} target="_blank" rel="noopener noreferrer"
                      className="text-white text-xs hover:text-[#E14B89] transition-colors truncate block">
                      {inv.filename}
                    </a>
                    <p className="text-slate-500 text-xs">{inv.project.client.name} · {inv.project.name}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {inv.amount ? (
                      <span className="text-[#F8903C] text-sm font-medium">{formatCurrency(inv.amount)}</span>
                    ) : (
                      <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">À payer</span>
                    )}
                    <p className="text-slate-600 text-xs mt-0.5">{formatDate(inv.createdAt)}</p>
                  </div>
                </div>
              ))}
              <div className="border-t border-slate-800 pt-3 mt-3 flex items-center justify-between">
                <span className="text-slate-400 text-sm">Total facturé</span>
                <span className="text-[#F8903C] font-semibold">{formatCurrency(totalCA)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
