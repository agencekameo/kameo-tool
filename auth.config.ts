import type { NextAuthConfig } from 'next-auth'

/**
 * Edge-compatible auth config (no Node.js dependencies — no prisma, no bcrypt).
 * Used by both middleware.ts (Edge runtime) and lib/auth.ts (Node.js runtime).
 */

// ─── Whitelist approach: pages each restricted role can access ────────────────
// ADMIN sees everything. Other roles only see the pages listed here.
// /profile and /messagerie (popup) are always accessible to all logged-in users.
const ROLE_ALLOWED_PATHS: Record<string, string[]> = {
  DEVELOPER:  ['/projects', '/wiki', '/audit'],
  REDACTEUR:  ['/projects', '/wiki', '/audit'],
  DESIGNER:   ['/projects', '/wiki', '/audit', '/aysha', '/gmb'],
  COMMERCIAL: ['/commerciaux', '/devis', '/audit', '/partenaires'],
}

// Pages always accessible to any logged-in user (regardless of role)
const ALWAYS_ALLOWED = ['/profile', '/email']

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
      // Always allow public signature pages and API
      if (pathname.startsWith('/signer/')) return true
      if (pathname.startsWith('/api/signature/')) return true
      // Always allow public client form pages and API
      if (pathname.startsWith('/formulaire/')) return true
      if (pathname.startsWith('/api/formulaire/')) return true
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

      // RBAC: whitelist approach for restricted roles
      if (isLoggedIn && role && role !== 'ADMIN') {
        const allowedPaths = ROLE_ALLOWED_PATHS[role]

        if (allowedPaths) {
          // Always allow common pages
          const isAlwaysAllowed = ALWAYS_ALLOWED.some(p => pathname === p || pathname.startsWith(p + '/'))
          if (isAlwaysAllowed) return true

          // Check if current path is in the role's whitelist
          const isAllowed = allowedPaths.some(p => pathname === p || pathname.startsWith(p + '/'))
          if (!isAllowed) {
            // Redirect to /projects (their default landing page)
            return Response.redirect(new URL('/projects', nextUrl))
          }
        }
      }

      return true
    },
  },
  providers: [], // filled in lib/auth.ts
}
