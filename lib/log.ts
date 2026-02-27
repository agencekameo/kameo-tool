import { prisma } from './db'

export async function createLog(
  userId: string,
  action: 'CRÉÉ' | 'MODIFIÉ' | 'SUPPRIMÉ',
  entity: string,
  entityId?: string,
  entityLabel?: string,
  details?: string
) {
  try {
    await prisma.log.create({
      data: { userId, action, entity, entityId, entityLabel, details },
    })
  } catch {
    // Non-blocking — log errors never break the main request
  }
}
