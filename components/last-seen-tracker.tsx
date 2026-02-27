'use client'

import { useEffect } from 'react'

export function LastSeenTracker() {
  useEffect(() => {
    fetch('/api/lastseen', { method: 'POST' }).catch(() => {})
  }, [])
  return null
}
