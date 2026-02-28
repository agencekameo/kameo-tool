import type { NextAuthConfig } from 'next-auth'

/**
 * Edge-compatible auth config (no Node.js dependencies — no prisma, no bcrypt).
 * Used by both middleware.ts (Edge runtime) and lib/auth.ts (Node.js runtime).
 */
export const authConfig: NextAuthConfig = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const pathname = nextUrl.pathname

      // Always allow NextAuth internal routes
      if (pathname.startsWith('/api/auth')) return true
      // Always allow public assets
      if (/\.(svg|png|jpg|jpeg|ico|webp|woff2?)$/.test(pathname)) return true

      // Redirect authenticated users away from login
      if (isLoggedIn && pathname === '/login') {
        return Response.redirect(new URL('/', nextUrl))
      }

      // Redirect unauthenticated users to login
      if (!isLoggedIn && pathname !== '/login') return false

      return true
    },
  },
  providers: [], // filled in lib/auth.ts
}
