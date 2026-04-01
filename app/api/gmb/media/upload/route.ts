import { auth } from '@/lib/auth'
import { uploadGmbMedia } from '@/lib/google-gmb'
import { put } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const account = formData.get('account') as string
  const location = formData.get('location') as string
  const file = formData.get('file') as File
  const category = (formData.get('category') as string) || 'ADDITIONAL'

  if (!account || !location || !file) {
    return NextResponse.json({ error: 'account, location, and file required' }, { status: 400 })
  }

  try {
    // Upload to Vercel Blob first to get a public URL
    const blob = await put(`gmb-photos/${Date.now()}-${file.name}`, file, { access: 'public' })

    // Then upload to GMB using the public URL
    const result = await uploadGmbMedia(account, location, blob.url, category)
    return NextResponse.json({ media: result, blobUrl: blob.url })
  } catch (err) {
    console.error('GMB upload error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
