'use client'

import { useState } from 'react'
import { Sidebar } from './sidebar'
import { Menu } from 'lucide-react'
import Image from 'next/image'

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      {/* Main content */}
      <main className="min-h-screen md:ml-60">
        {/* Mobile top bar — only visible on small screens */}
        <div className="md:hidden sticky top-0 z-20 flex items-center h-14 px-4 bg-[#0d0d14] border-b border-slate-800/60">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 -ml-1 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/50 transition-colors"
            aria-label="Ouvrir le menu"
          >
            <Menu size={20} />
          </button>
          <div className="ml-3">
            <Image src="/kameo-logo.svg" alt="Kameo" width={80} height={22} priority />
          </div>
        </div>

        {children}
      </main>
    </>
  )
}
