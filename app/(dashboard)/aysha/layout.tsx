import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Aysha' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
