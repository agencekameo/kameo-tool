import { prisma } from '@/lib/db'

interface CreateNotificationParams {
  userId: string
  type: string
  title: string
  message: string
  link?: string
}

export async function createNotification({ userId, type, title, message, link }: CreateNotificationParams) {
  try {
    await prisma.notification.create({
      data: { userId, type, title, message, link },
    })
  } catch {
    // Non-blocking — notification failure should never break the main action
  }
}

export async function createNotificationForAdmins({ type, title, message, link }: Omit<CreateNotificationParams, 'userId'>) {
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    })
    await prisma.notification.createMany({
      data: admins.map(admin => ({ userId: admin.id, type, title, message, link })),
    })
  } catch {
    // Non-blocking
  }
}
