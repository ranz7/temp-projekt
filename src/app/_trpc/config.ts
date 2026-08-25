'use client'

import type { AppRouter } from '@backend/appRouter'
import { createTRPCContext } from '@trpc/tanstack-react-query'

export const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>()
