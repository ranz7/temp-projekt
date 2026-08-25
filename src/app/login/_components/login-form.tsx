'use client'

import { useMutation } from '@tanstack/react-query'
import { TRPCClientError } from '@trpc/client'
import { type FormEvent, useState } from 'react'
import { z } from 'zod'
import { useTRPC } from '@/app/_trpc/config'

const USERNAME_PATTERN = '^[A-Za-z0-9_.-]+$'
const USERNAME_MAX_LENGTH = 64

// A failed `input()` validation reaches the client as the JSON-stringified
// zod issue list, not a plain sentence. Unwrap it into readable text.
const ZodIssueListZ = z.array(z.object({ message: z.string() })).min(1)

function readableLoginError(error: unknown): string {
  if (!(error instanceof TRPCClientError)) {
    return 'Could not sign you in. Try again.'
  }

  try {
    const issues = ZodIssueListZ.safeParse(JSON.parse(error.message))
    if (issues.success) {
      return issues.data.map(issue => issue.message).join(' ')
    }
  } catch {
    // Not a JSON issue list - fall through to the raw message below.
  }

  return error.message
}

export function LoginForm() {
  const trpc = useTRPC()
  const [username, setUsername] = useState('')

  const logInMutation = useMutation(
    trpc.account.logIn.mutationOptions({
      onSuccess: () => {
        // A client-side router.push() here can land on '/' before the root
        // layout's Suspense-wrapped header (an async Server Component) has
        // re-fetched with the new session cookie - Next's segment cache
        // reuses the still-stale, signed-out header render. A full
        // navigation always re-renders the whole tree from the server with
        // the cookie the browser just received, so the header is correct
        // the instant the page shows.
        window.location.assign('/')
      }
    })
  )

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    logInMutation.mutate({ username })
  }

  const errorMessage = logInMutation.isError ? readableLoginError(logInMutation.error) : null

  return (
    <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
      <div className='flex flex-col gap-1.5'>
        <label htmlFor='username' className='font-medium text-sm'>
          Username
        </label>
        <input
          id='username'
          name='username'
          type='text'
          autoComplete='username'
          required
          maxLength={USERNAME_MAX_LENGTH}
          pattern={USERNAME_PATTERN}
          value={username}
          onChange={event => setUsername(event.target.value)}
          className='rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent'
          placeholder='letters, digits, _ - .'
        />
      </div>
      {errorMessage !== null ? (
        <p role='alert' className='text-danger text-sm'>
          {errorMessage}
        </p>
      ) : null}
      <button
        type='submit'
        disabled={logInMutation.isPending || username.length === 0}
        className='rounded-lg bg-accent px-3 py-2 font-medium text-accent-foreground text-sm disabled:opacity-60'
      >
        {logInMutation.isPending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
