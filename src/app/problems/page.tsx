import { redirect } from 'next/navigation'

/** The problem list lives on `/`; this only exists so the header's Problems link works. */
export default function ProblemsIndexPage() {
  redirect('/')
}
