import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createNotificationForAdmins } from '@/lib/notifications'

const PIPELINE_BY_PRESTATION: Record<string, string[]> = {
  'Site web': ['REDACTION', 'MAQUETTE', 'INTEGRATION', 'OPTIMISATIONS', 'TESTING', 'LIVRAISON'],
  'Web app': ['MAQUETTE', 'DEVELOPPEMENT', 'TESTING', 'LIVRAISON'],
  'Branding': ['CONCEPTION', 'LIVRAISON'],
}

async function findForm(identifier: string) {
  // Try slug first, then token
  return (
    await prisma.clientForm.findUnique({ where: { slug: identifier } }) ||
    await prisma.clientForm.findUnique({ where: { token: identifier } })
  )
}

// GET – get form data (public, no auth)
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token: identifier } = await params

  const form = await findForm(identifier)
  if (!form) return NextResponse.json({ error: 'Formulaire introuvable' }, { status: 404 })

  const fullForm = await prisma.clientForm.findUnique({
    where: { id: form.id },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          type: true,
          client: { select: { name: true, company: true } },
        },
      },
    },
  })

  return NextResponse.json(fullForm)
}

// POST – save form data (public, no auth)
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token: identifier } = await params
  const body = await req.json()

  const form = await findForm(identifier)
  if (!form) return NextResponse.json({ error: 'Formulaire introuvable' }, { status: 404 })

  const data: Record<string, unknown> = {}

  if (body.cdcData !== undefined) {
    data.cdcData = body.cdcData
    data.cdcCompleted = true
  }
  if (body.docsData !== undefined) {
    data.docsData = body.docsData
    data.docsCompleted = true
  }
  if (body.briefData !== undefined) {
    data.briefData = body.briefData
    data.briefCompleted = true
  }
  if (body.designData !== undefined) {
    data.designData = body.designData
    data.designCompleted = true
  }
  if (body.accesData !== undefined) {
    data.accesData = body.accesData
    data.accesCompleted = true
  }

  const updated = await prisma.clientForm.update({
    where: { id: form.id },
    data,
  })

  // Check if all 4 categories are now complete
  const briefDone = updated.briefCompleted
  const designDone = updated.designCompleted
  const accesDone = updated.accesCompleted
  const docsDone = updated.docsCompleted
  const allComplete = briefDone && designDone && accesDone && docsDone

  if (allComplete) {
    // Get project info for notification
    const project = await prisma.project.findUnique({
      where: { id: form.projectId },
      select: { id: true, name: true, status: true, services: true, assignments: { select: { status: true, user: { select: { role: true } } } } },
    })

    if (project) {
      // Send notification to admins
      await createNotificationForAdmins({
        type: 'FORM_COMPLETE',
        title: 'Formulaire projet complet',
        message: `Le client a rempli les 4 catégories du formulaire pour "${project.name}" (Brief, Design, Accès, Documents).`,
        link: `/projects/${project.id}`,
      })

      // Auto-activate step 1 of pipeline if project is still in BRIEF status
      if (project.status === 'BRIEF') {
        const nonAdminAssignments = project.assignments.filter(a => a.user.role !== 'ADMIN')
        const allAccepted = nonAdminAssignments.length === 0 || nonAdminAssignments.every(a => a.status === 'VALIDE')

        if (allAccepted) {
          const prestation = project.services?.[0] || ''
          const pipeline = PIPELINE_BY_PRESTATION[prestation] || ['REDACTION', 'MAQUETTE', 'DEVELOPPEMENT', 'LIVRAISON']
          const firstStep = pipeline[0]

          await prisma.project.update({
            where: { id: project.id },
            data: { status: firstStep as never },
          })
        }
      }
    }
  }

  return NextResponse.json(updated)
}
