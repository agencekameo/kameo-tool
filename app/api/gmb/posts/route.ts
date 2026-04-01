import { auth } from '@/lib/auth'
import { getGmbPosts, createGmbPost } from '@/lib/google-gmb'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const account = req.nextUrl.searchParams.get('account')
  const location = req.nextUrl.searchParams.get('location')
  if (!account || !location) {
    return NextResponse.json({ posts: [], error: 'Params manquants' })
  }

  try {
    const result = await getGmbPosts(account, location)
    return NextResponse.json({ posts: result.posts, error: result.error })
  } catch (err) {
    return NextResponse.json({ posts: [], error: `Exception: ${err instanceof Error ? err.message : String(err)}` })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { account, location, summary, topicType } = await req.json()
  if (!account || !location || !summary) {
    return NextResponse.json({ error: 'account, location, and summary required' }, { status: 400 })
  }

  try {
    const post = await createGmbPost(account, location, { summary, topicType })
    return NextResponse.json({ post })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
