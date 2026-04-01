import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Petits projets' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
