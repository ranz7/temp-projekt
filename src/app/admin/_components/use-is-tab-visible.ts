'use client'

import { useSyncExternalStore } from 'react'

function subscribe(callback: () => void): () => void {
  document.addEventListener('visibilitychange', callback)
  return () => document.removeEventListener('visibilitychange', callback)
}

function getSnapshot(): boolean {
  return document.visibilityState === 'visible'
}

function getServerSnapshot(): boolean {
  return true
}

/**
 * Whether this tab is the one the person is looking at. Drives the panel's polling: it
 * never refetches while hidden, whatever else is happening.
 */
export function useIsTabVisible(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
