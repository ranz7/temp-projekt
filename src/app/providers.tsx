'use client'

import type { DehydratedState } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { TrpcProvider } from './_trpc/TrpcProvider'

export function GlobalProviders({
  children,
  dehydratedState
}: {
  children: ReactNode
  dehydratedState?: DehydratedState
}) {
  return <TrpcProvider dehydratedState={dehydratedState}>{children}</TrpcProvider>
}
