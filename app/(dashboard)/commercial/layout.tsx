import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Commercial' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
