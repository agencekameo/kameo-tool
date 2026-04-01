'use client'

import { useState } from 'react'
import { Bell, Check, X, Users, FolderKanban, MessageSquare, FileCheck, CreditCard, ClipboardList } from 'lucide-react'

interface NotifConfig {
  id: string
  name: string
  description: string
  type: 'equipe' | 'admin'
  notifType: string
  enabled: boolean
}

const NOTIF_CONFIGS: NotifConfig[] = [
  // ── Notifications équipe ──
  {
    id: 'mission_new',
    name: 'Nouvelle mission',
    description: 'Notifie un freelance quand il est assigné à un nouveau projet.',
    type: 'equipe',
    notifType: 'MISSION_NEW',
    enabled: true,
  },
  {
    id: 'mission_updated',
    name: 'Mission mise à jour',
    description: 'Notifie un freelance quand la proposition pour sa mission est modifiée (prix, délai).',
    type: 'equipe',
    notifType: 'MISSION_UPDATED',
    enabled: true,
  },
  {
    id: 'mission_review',
    name: 'Revue de mission demandée',
    description: 'Notifie l\'admin quand un freelance demande une revue de contre-proposition.',
    type: 'equipe',
    notifType: 'MISSION_REVIEW',
    enabled: true,
  },
  {
    id: 'message',
    name: 'Nouveau message',
    description: 'Notifie les participants d\'une conversation quand un nouveau message est envoyé.',
    type: 'equipe',
    notifType: 'MESSAGE',
    enabled: true,
  },
  // ── Notifications admin ──
  {
    id: 'mission_accepted',
    name: 'Mission acceptée',
    description: 'Notifie les admins quand un freelance accepte une mission.',
    type: 'admin',
    notifType: 'MISSION_ACCEPTED',
    enabled: true,
  },
  {
    id: 'mission_counter',
    name: 'Contre-proposition reçue',
    description: 'Notifie les admins quand un freelance fait une contre-proposition sur une mission.',
    type: 'admin',
    notifType: 'MISSION_COUNTER',
    enabled: true,
  },
  {
    id: 'mission_refused',
    name: 'Mission refusée',
    description: 'Notifie les admins quand un freelance refuse une mission.',
    type: 'admin',
    notifType: 'MISSION_REFUSED',
    enabled: true,
  },
  {
    id: 'project_new',
    name: 'Nouveau projet créé',
    description: 'Notifie les admins quand un nouveau projet est créé.',
    type: 'admin',
    notifType: 'PROJECT_NEW',
    enabled: true,
  },
  {
    id: 'form_complete',
    name: 'Formulaire projet complet',
    description: 'Notifie les admins quand un client a rempli les 4 catégories du formulaire projet.',
    type: 'admin',
    notifType: 'FORM_COMPLETE',
    enabled: true,
  },
  {
    id: 'invoice_sent',
    name: 'Factures de maintenance envoyées',
    description: 'Notifie les admins quand les factures de maintenance mensuelles ont été envoyées.',
    type: 'admin',
    notifType: 'INVOICE_SENT',
    enabled: true,
  },
]

const NOTIF_TYPE_ICONS: Record<string, typeof Bell> = {
  MISSION_NEW: ClipboardList,
  MISSION_UPDATED: ClipboardList,
  MISSION_REVIEW: ClipboardList,
  MISSION_ACCEPTED: Check,
  MISSION_COUNTER: ClipboardList,
  MISSION_REFUSED: X,
  MESSAGE: MessageSquare,
  PROJECT_NEW: FolderKanban,
  FORM_COMPLETE: FileCheck,
  INVOICE_SENT: CreditCard,
}

const NOTIF_TYPE_COLORS: Record<string, string> = {
  MISSION_NEW: 'bg-[#E14B89]/10 text-[#E14B89]',
  MISSION_UPDATED: 'bg-blue-500/10 text-blue-400',
  MISSION_REVIEW: 'bg-amber-500/10 text-amber-400',
  MISSION_ACCEPTED: 'bg-green-500/10 text-green-400',
  MISSION_COUNTER: 'bg-orange-500/10 text-orange-400',
  MISSION_REFUSED: 'bg-red-500/10 text-red-400',
  MESSAGE: 'bg-purple-500/10 text-purple-400',
  PROJECT_NEW: 'bg-emerald-500/10 text-emerald-400',
  FORM_COMPLETE: 'bg-cyan-500/10 text-cyan-400',
  INVOICE_SENT: 'bg-teal-500/10 text-teal-400',
}

export default function NotificationsTab() {
  const [configs, setConfigs] = useState(NOTIF_CONFIGS)

  function toggleNotif(id: string) {
    setConfigs(prev => prev.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c))
  }

  const equipeNotifs = configs.filter(c => c.type === 'equipe')
  const adminNotifs = configs.filter(c => c.type === 'admin')

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div>
        <p className="text-slate-400 text-sm">
          Liste de toutes les notifications in-app envoyées via la cloche. Activez ou désactivez chaque type de notification.
        </p>
      </div>

      {/* Notifications équipe */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Users size={15} className="text-blue-400" />
          <h2 className="text-white font-semibold text-sm">Notifications équipe</h2>
          <span className="text-slate-600 text-xs">({equipeNotifs.length})</span>
        </div>
        <div className="space-y-2">
          {equipeNotifs.map(config => (
            <NotifCard key={config.id} config={config} onToggle={toggleNotif} />
          ))}
        </div>
      </div>

      {/* Notifications admin */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Bell size={15} className="text-amber-400" />
          <h2 className="text-white font-semibold text-sm">Notifications admin</h2>
          <span className="text-slate-600 text-xs">({adminNotifs.length})</span>
        </div>
        <div className="space-y-2">
          {adminNotifs.map(config => (
            <NotifCard key={config.id} config={config} onToggle={toggleNotif} />
          ))}
        </div>
      </div>
    </div>
  )
}

function NotifCard({ config, onToggle }: { config: NotifConfig; onToggle: (id: string) => void }) {
  const Icon = NOTIF_TYPE_ICONS[config.notifType] || Bell
  const colorClass = NOTIF_TYPE_COLORS[config.notifType] || 'bg-slate-500/10 text-slate-400'

  return (
    <div className={`bg-[#111118] border rounded-xl p-4 transition-colors ${config.enabled ? 'border-slate-800' : 'border-slate-800/50 opacity-60'}`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-white text-sm font-medium">{config.name}</p>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              config.type === 'equipe' ? 'bg-blue-500/10 text-blue-400' : 'bg-amber-500/10 text-amber-400'
            }`}>
              {config.type === 'equipe' ? 'Équipe' : 'Admin'}
            </span>
          </div>
          <p className="text-slate-500 text-xs leading-relaxed">{config.description}</p>
        </div>
        <button
          onClick={() => onToggle(config.id)}
          className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${config.enabled ? 'bg-green-500' : 'bg-slate-700'}`}
        >
          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${config.enabled ? 'left-5' : 'left-1'}`} />
        </button>
      </div>
    </div>
  )
}
