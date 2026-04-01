import { auth } from '@/lib/auth'
import { replyToGmbReview } from '@/lib/google-gmb'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { account, location, reviewId, comment } = await req.json()
  if (!account || !location || !reviewId || !comment) {
    return NextResponse.json({ error: 'All fields required' }, { status: 400 })
  }

  try {
    const result = await replyToGmbReview(account, location, reviewId, comment)
    return NextResponse.json({ reply: result })
  } catch (err) {
    console.error('GMB reply error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
