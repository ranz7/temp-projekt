'use client'

import { useEffect, useState } from 'react'

function readIsDark(): boolean {
  return document.documentElement.classList.contains('dark')
}

/**
 * The site's current theme, kept in sync with the `.dark` class the header's
 * toggle flips on `<html>`. There is no theme context - this observes the
 * class directly so client components (Monaco) can follow it.
 */
export function useSiteTheme(): 'dark' | 'light' {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    setIsDark(readIsDark())

    const observer = new MutationObserver(() => setIsDark(readIsDark()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    return () => observer.disconnect()
  }, [])

  return isDark ? 'dark' : 'light'
}
