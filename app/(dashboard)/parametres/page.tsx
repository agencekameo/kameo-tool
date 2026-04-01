'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Users2, Activity, HardDrive, Receipt, Mail, Bell, Settings, PenTool } from 'lucide-react'

const UsersTab = dynamic(() => import('../users/page'), { loading: () => <Loading /> })
const LogsTab = dynamic(() => import('../logs/page'), { loading: () => <Loading /> })
const BackupsTab = dynamic(() => import('../backups/page'), { loading: () => <Loading /> })
const FraisTab = dynamic(() => import('../notes-de-frais/page'), { loading: () => <Loading /> })
const MailsTab = dynamic(() => import('./mails-tab'), { loading: () => <Loading /> })
const NotificationsTab = dynamic(() => import('./notifications-tab'), { loading: () => <Loading /> })
const SignaturesTab = dynamic(() => import('./signatures-tab'), { loading: () => <Loading /> })

function Loading() {
  return <div className="text-slate-500 text-sm p-8">Chargement...</div>
}

const TABS = [
  { id: 'equipe', label: 'Équipe', icon: Users2 },
  { id: 'mails', label: 'Mails', icon: Mail },
  { id: 'signatures', label: 'Signatures', icon: PenTool },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'logs', label: 'Logs', icon: Activity },
  { id: 'backups', label: 'Backups', icon: HardDrive },
  { id: 'frais', label: 'Frais', icon: Receipt },
]

export default function ParametresPage() {
  const searchParams = useSearchParams()
  const defaultTab = searchParams.get('tab') || 'equipe'
  const [tab, setTab] = useState(defaultTab)

  return (
    <div className="flex flex-col h-full">
      {/* Header + Tabs */}
      <div className="px-4 sm:px-8 pt-6 pb-0 flex-shrink-0">
        <div className="flex items-center gap-2 mb-5">
          <Settings size={20} className="text-[#E14B89]" />
          <h1 className="text-2xl font-semibold text-white">Paramètres</h1>
        </div>
        <div className="flex gap-1 overflow-x-auto border-b border-slate-800 -mx-4 sm:-mx-8 px-4 sm:px-8">
          {TABS.map(t => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  active
                    ? 'border-[#E14B89] text-white'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                <Icon size={15} />
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab content — each tab renders its own page component */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'equipe' && <UsersTab />}
        {tab === 'mails' && <MailsTab />}
        {tab === 'signatures' && <SignaturesTab />}
        {tab === 'notifications' && <NotificationsTab />}
        {tab === 'logs' && <LogsTab />}
        {tab === 'backups' && <BackupsTab />}
        {tab === 'frais' && <FraisTab />}
      </div>
    </div>
  )
}
