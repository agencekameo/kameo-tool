'use client'

import Link from 'next/link'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Projets', icon: FolderKanban },
  { href: '/tasks', label: 'Tâches', icon: CheckSquare },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/wiki', label: 'Wiki & Ressources', icon: BookOpen },
  { href: '/audit', label: 'Audit', icon: Search },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-[#0d0d14] border-r border-slate-800/60 flex flex-col z-40">
      {/* Logo */}
      <div className="p-5 border-b border-slate-800/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">K</span>
          </div>
          <div>
            <span className="text-white font-semibold text-sm">Kameo</span>
            <p className="text-slate-500 text-xs">Outil interne</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group',
                active
                  ? 'bg-violet-600/15 text-violet-400 border border-violet-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              )}
            >
              <Icon size={17} className="flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight size={14} className="text-violet-400/60" />}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-slate-800/60">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-semibold text-xs">
              {session?.user?.name?.[0]?.toUpperCase() ?? '?'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">{session?.user?.name}</p>
            <p className="text-slate-500 text-xs truncate">{session?.user?.email}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-slate-500 hover:text-red-400 transition-colors"
            title="Déconnexion"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  )
}
