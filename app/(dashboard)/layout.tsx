import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="ml-60 flex-1 min-h-screen">
        {children}
      </main>
    </div>
  )
}
