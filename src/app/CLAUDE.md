# src/app/CLAUDE.md

Scope: Next.js 16 App Router. Homepage + HTTP handlers.

## Surfaces

- `/` - problem list with recent submissions activity panel
- `/problems/<slug>` - problem detail and submit editor
- `/ranking` - global ranking
- `/submissions` - public activity feed, no source code
- `/submissions/mine` - submissions by the signed-in user
- `/submissions/<id>` - submission detail (author only)
- `api/trpc` - tRPC endpoints

## Folder conventions

Inside any route folder, only Next.js special files at the top level:
`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `route.ts`.
Everything else lives in underscored sibling folders (`_components/`, `_trpc/`).

## Rendering

Server Components by default. `"use client"` only when state, effects, browser APIs, or event handlers are unavoidable.
Data fetching in RSC: `prefetch` / `prefetchAwaited` from `@/app/_trpc/rsc`.
Client: `useTRPC()` from `@/app/_trpc/config`.
Every route that waits on data ships a `loading.tsx` beside its `page.tsx`.
Interface copy is English throughout; problem statements render in their original language.

## React conventions

Named exports only, except Next.js special files which default-export.
One component per file. File naming: kebab-case. Components PascalCase.
Colors from CSS variables in `globals.css` - never Tailwind defaults like `bg-blue-500`.
No margins on children - `gap` on the parent.
