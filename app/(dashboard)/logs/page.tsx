'use client'

import { useEffect, useState } from 'react'
import { Activity, Trash2, Pencil, Plus, Search } from 'lucide-react'
import { ROLE_AVATAR_COLORS } from '@/lib/utils'

interface Log {
  id: string
  action: string
  entity: string
  entityLabel?: string
  details?: string
  createdAt: string
  user: { id: string; name: string; role: string; avatar?: string }
}

interface User { id: string; name: string }

const ACTION_COLORS: Record<string, string> = {
  'CRÉÉ': 'bg-green-500/15 text-green-400',
  'MODIFIÉ': 'bg-blue-500/15 text-blue-400',
  'SUPPRIMÉ': 'bg-red-500/15 text-red-400',
}

const ACTION_ICONS: Record<string, React.ElementType> = {
  'CRÉÉ': Plus,
  'MODIFIÉ': Pencil,
  'SUPPRIMÉ': Trash2,
}

const ENTITY_COLORS: Record<string, string> = {
  Projet: 'bg-purple-500/10 text-purple-400',
  Client: 'bg-teal-500/10 text-teal-400',
  Tâche: 'bg-blue-500/10 text-blue-400',
  'Audit SEO': 'bg-yellow-500/10 text-yellow-400',
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'À l\'instant'
  if (min < 60) return `Il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `Il y a ${h}h`
  const d = Math.floor(h / 24)
  if (d < 30) return `Il y a ${d}j`
  return new Date(date).toLocaleDateString('fr-FR')
}

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterAction, setFilterAction] = useState('TOUS')
  const [filterEntity, setFilterEntity] = useState('TOUS')
  const [filterUser, setFilterUser] = useState('TOUS')

  useEffect(() => {
    Promise.all([
      fetch('/api/logs').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
    ]).then(([l, u]) => { setLogs(l); setUsers(u) }).finally(() => setLoading(false))
  }, [])

  const entities = ['TOUS', ...Array.from(new Set(logs.map(l => l.entity)))]
  const actions = ['TOUS', 'CRÉÉ', 'MODIFIÉ', 'SUPPRIMÉ']

  const filtered = logs.filter(l => {
    const matchSearch = search === '' ||
      l.user.name.toLowerCase().includes(search.toLowerCase()) ||
      l.entityLabel?.toLowerCase().includes(search.toLowerCase()) ||
      l.entity.toLowerCase().includes(search.toLowerCase())
    const matchAction = filterAction === 'TOUS' || l.action === filterAction
    const matchEntity = filterEntity === 'TOUS' || l.entity === filterEntity
    const matchUser = filterUser === 'TOUS' || l.user.id === filterUser
    return matchSearch && matchAction && matchEntity && matchUser
  })

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Journal d&apos;activité</h1>
          <p className="text-slate-400 text-sm mt-1">{filtered.length} événement{filtered.length > 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-1.5 bg-[#111118] border border-slate-800 rounded-xl px-3 py-2">
          <Activity size={14} className="text-[#E14B89]" />
          <span className="text-slate-400 text-xs">Derniers 500 événements</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="bg-[#111118] border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#E14B89] transition-colors w-52"
          />
        </div>
        <div className="flex items-center gap-1 bg-[#111118] border border-slate-800 rounded-xl p-1">
          {actions.map(a => (
            <button
              key={a}
              onClick={() => setFilterAction(a)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterAction === a ? 'bg-[#E14B89] text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {a === 'TOUS' ? 'Toutes les actions' : a}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 bg-[#111118] border border-slate-800 rounded-xl p-1">
          {entities.map(e => (
            <button
              key={e}
              onClick={() => setFilterEntity(e)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterEntity === e ? 'bg-[#E14B89] text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {e === 'TOUS' ? 'Tout' : e}
            </button>
          ))}
        </div>
        {/* Member filter */}
        <select
          value={filterUser}
          onChange={e => setFilterUser(e.target.value)}
          className="bg-[#111118] border border-slate-800 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors cursor-pointer"
        >
          <option value="TOUS">Tous les membres</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-slate-500 text-sm">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Activity size={32} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500">Aucune activité enregistrée</p>
          <p className="text-slate-600 text-sm mt-1">Les actions sur le CRM apparaîtront ici</p>
        </div>
      ) : (
        <div className="bg-[#111118] border border-slate-800 rounded-2xl overflow-hidden">
          {filtered.map((log, i) => {
            const ActionIcon = ACTION_ICONS[log.action] ?? Activity
            const gradient = ROLE_AVATAR_COLORS[log.user.role] ?? 'from-slate-400 to-slate-600'
            return (
              <div
                key={log.id}
                className={`flex items-center gap-4 px-5 py-3.5 hover:bg-slate-800/20 transition-colors ${i < filtered.length - 1 ? 'border-b border-slate-800/50' : ''}`}
              >
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {log.user.avatar ? (
                    <img src={log.user.avatar} alt={log.user.name} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                      <span className="text-white font-semibold text-xs">{log.user.name[0]?.toUpperCase()}</span>
                    </div>
                  )}
                </div>

                {/* Action badge */}
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium flex-shrink-0 ${ACTION_COLORS[log.action] ?? 'bg-slate-800 text-slate-400'}`}>
                  <ActionIcon size={11} />
                  {log.action}
                </div>

                {/* Entity */}
                <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${ENTITY_COLORS[log.entity] ?? 'bg-slate-800/50 text-slate-400'}`}>
                  {log.entity}
                </span>

                {/* Label */}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm truncate">
                    <span className="text-slate-400">{log.user.name}</span>
                    {log.entityLabel && <span className="text-white"> · {log.entityLabel}</span>}
                  </p>
                  {log.details && (
                    <p className="text-slate-600 text-xs truncate mt-0.5">{log.details}</p>
                  )}
                </div>

                {/* Time */}
                <span className="text-slate-500 text-xs flex-shrink-0">{timeAgo(log.createdAt)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
