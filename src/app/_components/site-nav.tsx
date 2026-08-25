import Link from 'next/link'

const BASE_LINKS = [
  { href: '/problems', label: 'Problems' },
  { href: '/submissions', label: 'Submissions' },
  { href: '/ranking', label: 'Ranking' }
]

const SIGNED_IN_LINK = { href: '/submissions/mine', label: 'My submissions' }

/** Header navigation. "My submissions" only appears once someone is signed in. */
export function SiteNav({ isSignedIn }: { isSignedIn: boolean }) {
  const links = isSignedIn ? [...BASE_LINKS, SIGNED_IN_LINK] : BASE_LINKS

  return (
    <nav className='flex items-center gap-4 text-sm'>
      {links.map(link => (
        <Link key={link.href} href={link.href} className='text-muted hover:text-foreground'>
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
