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
  UserCircle,
  Wrench,
  TrendingUp,
  ListTodo,
  Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Projets', icon: FolderKanban },
  { href: '/tasks', label: 'Tâches', icon: CheckSquare },
  { href: '/aysha', label: 'Tâches Aysha', icon: ListTodo },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/maintenances', label: 'Maintenances', icon: Wrench },
  { href: '/commercial', label: 'Commercial', icon: TrendingUp },
  { href: '/finances', label: 'Finances', icon: Wallet },
  { href: '/wiki', label: 'Wiki & Ressources', icon: BookOpen },
  { href: '/audit', label: 'Audit', icon: Search },
]

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  DEVELOPER: 'Développeur',
  REDACTEUR: 'Rédacteur',
  DESIGNER: 'Designer',
  MEMBER: 'Membre',
}

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const isAdmin = (session?.user as { role?: string })?.role === 'ADMIN'

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-[#0d0d14] border-r border-slate-800/60 flex flex-col z-40">
      {/* Logo */}
      <div className="p-5 border-b border-slate-800/60">
        <div className="flex items-center gap-2.5">
          <Image
            src="/kameo-logo.svg"
            alt="Kameo"
            width={28}
            height={25}
            className="flex-shrink-0"
          />
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
                  ? 'bg-[#E14B89]/10 text-[#E14B89] border border-[#E14B89]/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              )}
            >
              <Icon size={17} className="flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight size={14} className="text-[#E14B89]/60" />}
            </Link>
          )
        })}

        {/* Admin section */}
        {isAdmin && (
          <>
            <div className="pt-3 pb-1">
              <p className="px-3 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                Administration
              </p>
            </div>
            <Link
              href="/users"
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group',
                pathname.startsWith('/users')
                  ? 'bg-[#E14B89]/10 text-[#E14B89] border border-[#E14B89]/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              )}
            >
              <ShieldCheck size={17} className="flex-shrink-0" />
              <span className="flex-1">Utilisateurs</span>
              {pathname.startsWith('/users') && <ChevronRight size={14} className="text-[#E14B89]/60" />}
            </Link>
          </>
        )}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-slate-800/60 space-y-1">
        <Link
          href="/profile"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group w-full',
            pathname === '/profile'
              ? 'bg-[#E14B89]/10 border border-[#E14B89]/20'
              : 'hover:bg-slate-800/50'
          )}
        >
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#E14B89] to-[#F8903C] flex items-center justify-center flex-shrink-0">
            <span className="text-white font-semibold text-xs">
              {session?.user?.name?.[0]?.toUpperCase() ?? '?'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn(
              'text-xs font-medium truncate',
              pathname === '/profile' ? 'text-[#F8903C]' : 'text-white group-hover:text-white'
            )}>
              {session?.user?.name}
            </p>
            <p className="text-slate-500 text-xs truncate">
              {ROLE_LABELS[(session?.user as { role?: string })?.role ?? ''] ?? (session?.user as { role?: string })?.role}
            </p>
          </div>
          <UserCircle size={14} className={cn(
            pathname === '/profile' ? 'text-[#E14B89]' : 'text-slate-600 group-hover:text-slate-400'
          )} />
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-400/5 transition-colors w-full text-sm"
        >
          <LogOut size={15} />
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  )
}
