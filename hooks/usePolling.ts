import { useEffect, useRef } from 'react'

export function usePolling(callback: () => void, intervalMs = 60000) {
  const savedCallback = useRef(callback)
  savedCallback.current = callback

  useEffect(() => {
    const interval = setInterval(() => savedCallback.current(), intervalMs)
    return () => clearInterval(interval)
  }, [intervalMs])
}
