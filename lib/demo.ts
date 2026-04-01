/**
 * Demo data isolation helpers.
 * DEMO users only see data created by other DEMO users.
 * Non-DEMO users never see demo data.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Session = { user?: { id?: string; role?: string } } | null

/** Returns Prisma `where` clause for models with `createdById` field */
export function demoWhere(session: Session): Record<string, unknown> {
  const role = (session?.user as { role?: string })?.role
  if (role === 'DEMO') {
    // Demo user sees only data created by DEMO users
    return { createdBy: { role: 'DEMO' } }
  }
  // Non-demo user: exclude demo data
  // NOT with relation filter: records with null createdBy are included, DEMO records are excluded
  return { NOT: { createdBy: { role: 'DEMO' } } }
}

/** Returns Prisma `where` clause for User model */
export function demoUserWhere(session: Session): Record<string, unknown> {
  const role = (session?.user as { role?: string })?.role
  if (role === 'DEMO') return { role: 'DEMO' }
  return { role: { not: 'DEMO' } }
}

/** Returns Prisma `where` clause for Prospect (uses assignedTo → user relation) */
export function demoProspectWhere(session: Session): Record<string, unknown> {
  const role = (session?.user as { role?: string })?.role
  if (role === 'DEMO') return { assignee: { role: 'DEMO' } }
  return { OR: [{ assignedTo: null }, { assignee: { role: { not: 'DEMO' } } }] }
}

/** Returns Prisma `where` clause for Task (filter via project.createdBy) */
export function demoTaskWhere(session: Session): Record<string, unknown> {
  const role = (session?.user as { role?: string })?.role
  if (role === 'DEMO') return { project: { createdBy: { role: 'DEMO' } } }
  return { OR: [{ projectId: null }, { project: { createdBy: { role: { not: 'DEMO' } } } }] }
}

/** Check if session belongs to a DEMO user */
export function isDemo(session: Session): boolean {
  return (session?.user as { role?: string })?.role === 'DEMO'
}

/** Returns a 403 Response if DEMO user tries to mutate. Use in POST/PATCH/DELETE handlers. */
export function demoGuard(session: Session): Response | null {
  if (isDemo(session)) {
    return Response.json({ error: 'Le compte démo est en lecture seule' }, { status: 403 })
  }
  return null
}
