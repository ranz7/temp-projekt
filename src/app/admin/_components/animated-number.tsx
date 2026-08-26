'use client'

import { useEffect, useRef, useState } from 'react'

const DURATION_MS = 700

/**
 * A number that travels to its new value instead of jumping, so a figure that keeps
 * climbing reads as one moving quantity rather than a flicker of unrelated digits.
 * Respects a reduced-motion preference by landing straight on the value.
 */
export function AnimatedNumber({
  value,
  format
}: {
  value: number
  format: (value: number) => string
}) {
  const [shown, setShown] = useState(value)
  const fromRef = useRef(value)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    const prefersLessMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersLessMotion) {
      fromRef.current = value
      setShown(value)
      return
    }

    const from = fromRef.current
    const startedAt = performance.now()

    function step(now: number) {
      const progress = Math.min((now - startedAt) / DURATION_MS, 1)
      // Ease out, so the number decelerates into place rather than stopping dead.
      const eased = 1 - (1 - progress) ** 3

      setShown(from + (value - from) * eased)

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step)
      } else {
        fromRef.current = value
      }
    }

    frameRef.current = requestAnimationFrame(step)

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      fromRef.current = value
    }
  }, [value])

  return <>{format(shown)}</>
}
