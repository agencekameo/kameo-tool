import { auth } from '@/lib/auth'
import { updateGmbLocation } from '@/lib/google-gmb'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { locationName, description, phone, website, address, hours } = await req.json()
  if (!locationName) return NextResponse.json({ error: 'locationName required' }, { status: 400 })

  try {
    console.log('[GMB API] Update location:', locationName, { description: !!description, phone: !!phone, website: !!website, address: !!address })
    const result = await updateGmbLocation(locationName, { description, phone, website, address, hours })
    return NextResponse.json({ location: result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GMB API] Update location error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
