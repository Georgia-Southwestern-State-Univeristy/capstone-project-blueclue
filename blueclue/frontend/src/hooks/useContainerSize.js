import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Hook that tracks the width / height of a container element via ResizeObserver.
 * Returns [ref, { width, height }].
 *
 * Usage:
 *   const [containerRef, { width }] = useContainerSize()
 *   return <div ref={containerRef}>…{width < 400 ? 'small' : 'big'}…</div>
 */
export default function useContainerSize() {
  const ref = useRef(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  const handleResize = useCallback((entries) => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect
      setSize(prev => {
        // Avoid re-renders when size hasn't actually changed (rounded px)
        const w = Math.round(width)
        const h = Math.round(height)
        if (prev.width === w && prev.height === h) return prev
        return { width: w, height: h }
      })
    }
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new ResizeObserver(handleResize)
    observer.observe(el)

    // Initial measurement
    const rect = el.getBoundingClientRect()
    setSize({ width: Math.round(rect.width), height: Math.round(rect.height) })

    return () => observer.disconnect()
  }, [handleResize])

  return [ref, size]
}
