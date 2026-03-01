import type { NextAuthConfig } from 'next-auth'

/**
 * Edge-compatible auth config (no Node.js dependencies — no prisma, no bcrypt).
 * Used by both middleware.ts (Edge runtime) and lib/auth.ts (Node.js runtime).
 */

// Pages accessible only by ADMIN
const ADMIN_ONLY_PATHS = ['/users', '/logs', '/backups', '/notes-de-frais', '/contrats']

// Pages reserved for ADMIN (president-level)
const PRESIDENT_PATHS = ['/finances', '/objectifs', '/aysha']

export const authConfig: NextAuthConfig = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    // Expose role + id into the session so the Edge middleware can read them
    // (no Node.js deps here — purely reads from the already-decoded JWT token)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    session({ session, token }: any) {
      if (token && session.user) {
        session.user.role = token.role
        session.user.id = token.sub
      }
      return session
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const pathname = nextUrl.pathname
      const role = (auth as { user?: { role?: string } })?.user?.role

      // Always allow NextAuth internal routes
      if (pathname.startsWith('/api/auth')) return true
      // Always allow setup route (first-time DB initialization)
      if (pathname === '/setup' || pathname.startsWith('/api/setup')) return true
      // Always allow API routes for logged-in users
      if (pathname.startsWith('/api/')) return isLoggedIn
      // Always allow public assets
      if (/\.(svg|png|jpg|jpeg|ico|webp|woff2?)$/.test(pathname)) return true

      // Redirect authenticated users away from login
      if (isLoggedIn && pathname === '/login') {
        return Response.redirect(new URL('/', nextUrl))
      }

      // Redirect unauthenticated users to login
      if (!isLoggedIn && pathname !== '/login') return false

      // RBAC: user is logged in — check role-based restrictions
      if (isLoggedIn && role !== 'ADMIN') {
        // Non-admin users cannot access admin-only paths
        const isAdminOnly = ADMIN_ONLY_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
        if (isAdminOnly) {
          return Response.redirect(new URL('/', nextUrl))
        }

        // Non-admin users cannot access president-level paths
        const isPresidentOnly = PRESIDENT_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
        if (isPresidentOnly) {
          return Response.redirect(new URL('/', nextUrl))
        }
      }

      return true
    },
  },
  providers: [], // filled in lib/auth.ts
}
