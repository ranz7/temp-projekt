'use client'

/** Key the chosen theme is stored under. Read by the pre-hydration script in `layout.tsx`. */
export const THEME_STORAGE_KEY = 'oj-theme'

function toggleTheme() {
  const root = document.documentElement
  const isDark = root.classList.toggle('dark')

  try {
    localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light')
  } catch {
    // Storage may be unavailable (private mode) - the toggle still works for this load.
  }
}

/**
 * Sun/moon toggle. Both icons render on server and client alike; only CSS
 * (driven by the `.dark` class already on `<html>` before hydration) decides
 * which one shows, so there is no hydration mismatch to guard against.
 */
export function ThemeToggle() {
  return (
    <button
      type='button'
      onClick={toggleTheme}
      aria-label='Toggle theme'
      className='flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-foreground hover:bg-placeholder'
    >
      <svg
        aria-hidden='true'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
        className='size-4 dark:hidden'
      >
        <circle cx='12' cy='12' r='4' />
        <path d='M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41' />
      </svg>
      <svg
        aria-hidden='true'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
        className='hidden size-4 dark:block'
      >
        <path d='M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z' />
      </svg>
    </button>
  )
}
