import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'

// POST – upload a file (public, no auth – used by client form)
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const token = formData.get('token') as string | null
    const category = formData.get('category') as string | null
    const docName = formData.get('docName') as string | null

    if (!file || !token) {
      return NextResponse.json({ error: 'Fichier et token requis' }, { status: 400 })
    }

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'Fichier trop volumineux (max 50 Mo)' }, { status: 400 })
    }

    // Build a clean path
    const ext = file.name.split('.').pop() || 'bin'
    const safeName = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 50)
    const path = `formulaire/${token}/${category || 'autres'}/${safeName}-${Date.now()}.${ext}`

    const blob = await put(path, file, {
      access: 'public',
      addRandomSuffix: false,
    })

    return NextResponse.json({
      url: blob.url,
      filename: file.name,
      size: file.size,
      docName: docName || file.name,
    })
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: 'Erreur lors de l\'upload' }, { status: 500 })
  }
}
