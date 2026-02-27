'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Users,
  BookOpen,
  Search,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Wrench,
  ListTodo,
  Wallet,
  User,
  ChevronUp,
  Mail,
  Activity,
} from 'lucide-react'
import { cn, ROLE_LABELS } from '@/lib/utils'
import { useState, useRef, useEffect } from 'react'

const sections = [
  {
    label: 'Vue d\'ensemble',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/finances', label: 'Finances', icon: Wallet },
      { href: '/clients', label: 'Clients', icon: Users },
      { href: '/tasks', label: 'Tâches', icon: CheckSquare },
    ],
  },
  {
    label: 'Suivi',
    items: [
      { href: '/projects', label: 'Projets', icon: FolderKanban },
      { href: '/maintenances', label: 'Maintenances', icon: Wrench },
      { href: '/aysha', label: 'Tâches Aysha', icon: ListTodo },
    ],
  },
  {
    label: 'Ressources',
    items: [
      { href: '/wiki', label: 'Wiki & Ressources', icon: BookOpen },
      { href: '/audit', label: 'Audit SEO', icon: Search },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const isAdmin = (session?.user as { role?: string })?.role === 'ADMIN'
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const role = (session?.user as { role?: string })?.role ?? ''
  const avatar = (session?.user as { avatar?: string })?.avatar

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function isActive(href: string) {
    return href === '/' ? pathname === '/' : pathname.startsWith(href)
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-[#0d0d14] border-r border-slate-800/60 flex flex-col z-40">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-slate-800/60">
        <div className="flex items-center gap-2.5">
          <Image src="/kameo-logo.svg" alt="Agence Kameo" width={26} height={23} className="flex-shrink-0" />
          <div>
            <span className="text-white font-semibold text-sm">Agence Kameo</span>
            <p className="text-slate-500 text-xs">Outil interne</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-4">
        {sections.map(section => (
          <div key={section.label}>
            <p className="px-3 mb-1 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150',
                    isActive(href)
                      ? 'bg-[#E14B89]/10 text-[#E14B89] border border-[#E14B89]/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  )}
                >
                  <Icon size={16} className="flex-shrink-0" />
                  <span className="flex-1 truncate">{label}</span>
                  {isActive(href) && <ChevronRight size={13} className="text-[#E14B89]/60 flex-shrink-0" />}
                </Link>
              ))}
            </div>
          </div>
        ))}

        {/* Admin — admin only */}
        {isAdmin && (
          <div>
            <p className="px-3 mb-1 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Admin</p>
            <div className="space-y-0.5">
              <Link href="/users"
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150',
                  pathname.startsWith('/users')
                    ? 'bg-[#E14B89]/10 text-[#E14B89] border border-[#E14B89]/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                )}>
                <ShieldCheck size={16} className="flex-shrink-0" />
                <span className="flex-1">Équipe</span>
                {pathname.startsWith('/users') && <ChevronRight size={13} className="text-[#E14B89]/60 flex-shrink-0" />}
              </Link>
              <Link href="/logs"
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150',
                  pathname.startsWith('/logs')
                    ? 'bg-[#E14B89]/10 text-[#E14B89] border border-[#E14B89]/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                )}>
                <Activity size={16} className="flex-shrink-0" />
                <span className="flex-1">Logs</span>
                {pathname.startsWith('/logs') && <ChevronRight size={13} className="text-[#E14B89]/60 flex-shrink-0" />}
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* User dropdown */}
      <div className="p-2 border-t border-slate-800/60" ref={dropdownRef}>
        {dropdownOpen && (
          <div className="mb-2 bg-[#111118] border border-slate-700 rounded-xl overflow-hidden shadow-xl">
            <Link href="/profile" onClick={() => setDropdownOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors text-sm">
              <User size={14} />
              Mon profil
            </Link>
            <Link href="/email" onClick={() => setDropdownOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors text-sm">
              <Mail size={14} />
              Composer un email
            </Link>
            <div className="border-t border-slate-800" />
            <button onClick={() => signOut({ callbackUrl: '/login' })}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-red-400 hover:text-red-300 hover:bg-red-400/5 transition-colors text-sm">
              <LogOut size={14} />
              Se déconnecter
            </button>
          </div>
        )}

        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all w-full group',
            dropdownOpen ? 'bg-slate-800/70' : 'hover:bg-slate-800/50'
          )}
        >
          <div className="w-7 h-7 rounded-full flex-shrink-0 overflow-hidden">
            {avatar ? (
              <img src={avatar} alt={session?.user?.name ?? ''} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#E14B89] to-[#F8903C] flex items-center justify-center">
                <span className="text-white font-semibold text-xs">
                  {session?.user?.name?.[0]?.toUpperCase() ?? '?'}
                </span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-xs font-medium text-white truncate">{session?.user?.name}</p>
            <p className="text-slate-500 text-xs truncate">{ROLE_LABELS[role] ?? role}</p>
          </div>
          <ChevronUp size={13} className={cn('text-slate-600 flex-shrink-0 transition-transform', dropdownOpen ? 'rotate-0' : 'rotate-180')} />
        </button>
      </div>
    </aside>
  )
}
