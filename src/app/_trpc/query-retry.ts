import { TRPCClientError } from '@trpc/client'

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof TRPCClientError) {
    return false
  }

  return failureCount < 2
}
