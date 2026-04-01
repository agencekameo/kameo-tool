import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard-shell'
import { LastSeenTracker } from '@/components/last-seen-tracker'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <DashboardShell>
      <LastSeenTracker />
      {children}
    </DashboardShell>
  )
}
