import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { generateSlug } from '@/lib/utils'

// GET – get or create form token for this project
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  let form = await prisma.clientForm.findUnique({ where: { projectId: id } })

  if (!form) {
    const project = await prisma.project.findUnique({
      where: { id },
      select: { name: true, client: { select: { name: true, company: true } } },
    })
    const baseName = project?.client?.company || project?.client?.name || project?.name || 'projet'
    const slug = await generateSlug(baseName)
    form = await prisma.clientForm.create({
      data: { projectId: id, slug },
    })
  }

  return NextResponse.json(form)
}
