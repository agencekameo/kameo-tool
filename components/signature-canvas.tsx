'use client'

import { useRef, useEffect, useState, useCallback } from 'react'

interface SignatureCanvasProps {
  onSignatureChange: (dataUrl: string | null) => void
  width?: number
  height?: number
}

export default function SignatureCanvas({ onSignatureChange, width = 600, height = 200 }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDrawing = useRef(false)
  const hasContent = useRef(false)
  const [isEmpty, setIsEmpty] = useState(true)

  // Initialize canvas
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const w = Math.floor(rect.width)
    const h = height

    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.scale(dpr, dpr)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1a1a2e'
  }, [height])

  useEffect(() => {
    initCanvas()

    const handleResize = () => {
      if (!hasContent.current) {
        initCanvas()
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [initCanvas])

  function getCoords(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()

    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0]
      if (!touch) return null
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      }
    }

    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  function startDrawing(e: React.MouseEvent | React.TouchEvent) {
    const coords = getCoords(e)
    if (!coords) return

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return

    isDrawing.current = true
    ctx.beginPath()
    ctx.moveTo(coords.x, coords.y)
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing.current) return
    e.preventDefault()

    const coords = getCoords(e)
    if (!coords) return

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return

    ctx.lineTo(coords.x, coords.y)
    ctx.stroke()
    hasContent.current = true
    if (isEmpty) setIsEmpty(false)
  }

  function stopDrawing() {
    if (!isDrawing.current) return
    isDrawing.current = false

    const canvas = canvasRef.current
    if (!canvas || !hasContent.current) return

    onSignatureChange(canvas.toDataURL('image/png'))
  }

  function clear() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return

    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const w = Math.floor(rect.width)

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, height)

    hasContent.current = false
    setIsEmpty(true)
    onSignatureChange(null)
  }

  return (
    <div className="relative" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className={`w-full rounded-xl cursor-crosshair ${
          isEmpty
            ? 'border-2 border-dashed border-gray-300'
            : 'border-2 border-solid border-gray-400'
        }`}
        style={{ touchAction: 'none', height: `${height}px` }}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />

      {/* Placeholder text */}
      {isEmpty && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-gray-300 text-lg font-light select-none">Signez ici</span>
        </div>
      )}

      {/* Clear button */}
      {!isEmpty && (
        <button
          type="button"
          onClick={clear}
          className="absolute top-2 right-2 text-xs text-gray-400 hover:text-gray-600 bg-white/90 border border-gray-200 px-2.5 py-1 rounded-lg transition-colors"
        >
          Effacer
        </button>
      )}
    </div>
  )
}
