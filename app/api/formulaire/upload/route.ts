import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { rateLimit, csrfCheck } from '@/lib/security'

const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'zip', 'svg']
const ALLOWED_CATEGORIES = ['docs', 'designs', 'briefs', 'autres', 'logos', 'contenus', 'inspirations', 'chartes']

// Magic bytes for common file types (validates file content matches extension)
const MAGIC_BYTES: Record<string, number[][]> = {
  pdf: [[0x25, 0x50, 0x44, 0x46]], // %PDF
  jpg: [[0xFF, 0xD8, 0xFF]],
  jpeg: [[0xFF, 0xD8, 0xFF]],
  png: [[0x89, 0x50, 0x4E, 0x47]], // .PNG
  gif: [[0x47, 0x49, 0x46, 0x38]], // GIF8
  webp: [[0x52, 0x49, 0x46, 0x46]], // RIFF
  zip: [[0x50, 0x4B, 0x03, 0x04], [0x50, 0x4B, 0x05, 0x06]], // PK
  doc: [[0xD0, 0xCF, 0x11, 0xE0]], // OLE2
  docx: [[0x50, 0x4B, 0x03, 0x04]], // ZIP-based
  xls: [[0xD0, 0xCF, 0x11, 0xE0]],
  xlsx: [[0x50, 0x4B, 0x03, 0x04]],
  ppt: [[0xD0, 0xCF, 0x11, 0xE0]],
  pptx: [[0x50, 0x4B, 0x03, 0x04]],
}

function validateMagicBytes(buffer: ArrayBuffer, ext: string): boolean {
  const signatures = MAGIC_BYTES[ext]
  if (!signatures) return true // No magic bytes check for txt, csv, svg — validated by extension only
  const bytes = new Uint8Array(buffer).slice(0, 8)
  return signatures.some(sig => sig.every((b, i) => bytes[i] === b))
}

// POST – upload a file (public, no auth – used by client form)
export async function POST(req: NextRequest) {
  // CSRF protection
  if (!csrfCheck(req)) {
    return NextResponse.json({ error: 'Requête non autorisée.' }, { status: 403 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const token = formData.get('token') as string | null
    const category = formData.get('category') as string | null
    const docName = formData.get('docName') as string | null

    if (!file || !token) {
      return NextResponse.json({ error: 'Fichier et token requis' }, { status: 400 })
    }

    // Rate limit: max 20 uploads per token per 10 minutes
    if (!rateLimit(`upload:${token}`, 20, 10 * 60 * 1000)) {
      return NextResponse.json({ error: 'Trop de fichiers envoyés. Réessayez plus tard.' }, { status: 429 })
    }

    // Validate token format (cuid or similar — alphanumeric only)
    if (!/^[a-zA-Z0-9_-]+$/.test(token)) {
      return NextResponse.json({ error: 'Token invalide' }, { status: 400 })
    }

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'Fichier trop volumineux (max 50 Mo)' }, { status: 400 })
    }

    // Validate extension
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: `Extension .${ext} non autorisée` }, { status: 400 })
    }

    // Validate magic bytes (file content matches extension)
    const fileBuffer = await file.arrayBuffer()
    if (!validateMagicBytes(fileBuffer, ext)) {
      return NextResponse.json({ error: `Le contenu du fichier ne correspond pas à l'extension .${ext}` }, { status: 400 })
    }

    // Sanitize category (prevent path traversal)
    const safeCategory = (category && ALLOWED_CATEGORIES.includes(category)) ? category : 'autres'

    // Build a clean path
    const safeName = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 50)
    const path = `formulaire/${token}/${safeCategory}/${safeName}-${Date.now()}.${ext}`

    const blob = await put(path, Buffer.from(fileBuffer), {
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
