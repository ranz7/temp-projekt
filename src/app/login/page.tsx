import Link from 'next/link'
import { getCurrentUser } from '@/app/_hooks/get-current-user'
import { Card } from '../_components/card'
import { PageHeader } from '../_components/page-header'
import { LoginForm } from './_components/login-form'

export default async function LoginPage() {
  const user = await getCurrentUser()

  return (
    <div className='mx-auto flex w-full max-w-sm flex-col gap-6'>
      <PageHeader title='Sign in' description='Just a username - no password needed.' />
      <Card bodyClassName='p-4 sm:p-5'>
        {user !== null ? (
          <p className='text-sm'>
            You're already signed in as <span className='font-medium'>{user.username}</span>.{' '}
            <Link href='/' className='text-accent underline'>
              Go home
            </Link>
          </p>
        ) : (
          <LoginForm />
        )}
      </Card>
    </div>
  )
}
