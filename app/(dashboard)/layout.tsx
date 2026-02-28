import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard-shell'
import { LastSeenTracker } from '@/components/last-seen-tracker'

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
