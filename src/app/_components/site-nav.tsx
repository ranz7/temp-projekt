import Link from 'next/link'

const LINKS = [
  { href: '/problems', label: 'Problems' },
  { href: '/submissions', label: 'Submissions' },
  { href: '/ranking', label: 'Ranking' }
]

/**
 * Header navigation. Fixed regardless of who is signed in, so it renders
 * synchronously and mounts (and prefetches) exactly once per page load -
 * the signed-in-only "My submissions" link lives in `HeaderSession` instead.
 */
export function SiteNav() {
  return (
    <nav className='flex items-center gap-4 text-sm'>
      {LINKS.map(link => (
        <Link key={link.href} href={link.href} className='text-muted hover:text-foreground'>
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
