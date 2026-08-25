'use client'

import { useEffect, useRef, useState } from 'react'
import {
  formatLanguageLabel,
  type SubmissionLanguageCode,
  submissionSourceFileName
} from '../../_lib/format'

type SourcePanelProps = {
  problemSlug: string
  submissionId: string
  language: SubmissionLanguageCode
  sourceCode: string
}

type CopyState = 'idle' | 'copied' | 'failed'

const COPY_RESET_MS = 2000

const ACTION_BUTTON_CLASSES =
  'rounded-lg border border-border px-3 py-1.5 font-medium text-xs hover:bg-placeholder'

/** Your own source: read-only, with copy-to-clipboard and a download that never touches the server again. */
export function SourcePanel({ problemSlug, submissionId, language, sourceCode }: SourcePanelProps) {
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current !== null) clearTimeout(resetTimeoutRef.current)
    }
  }, [])

  function scheduleReset() {
    if (resetTimeoutRef.current !== null) clearTimeout(resetTimeoutRef.current)
    resetTimeoutRef.current = setTimeout(() => setCopyState('idle'), COPY_RESET_MS)
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(sourceCode)
      setCopyState('copied')
    } catch {
      // Clipboard access can be refused (permissions, insecure context) - say so instead of throwing.
      setCopyState('failed')
    }
    scheduleReset()
  }

  function handleDownload() {
    const blob = new Blob([sourceCode], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = submissionSourceFileName(problemSlug, submissionId, language)
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className='flex flex-col gap-3 rounded-xl border border-border bg-card p-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <h2 className='font-medium text-sm'>Source code ({formatLanguageLabel(language)})</h2>
        <div className='flex items-center gap-2'>
          <button type='button' onClick={handleCopy} className={ACTION_BUTTON_CLASSES}>
            {copyState === 'copied' ? 'Copied!' : copyState === 'failed' ? 'Copy failed' : 'Copy'}
          </button>
          <button type='button' onClick={handleDownload} className={ACTION_BUTTON_CLASSES}>
            Download
          </button>
        </div>
      </div>
      <pre className='max-h-[28rem] w-full overflow-auto rounded-lg border border-border bg-background p-3 font-mono text-xs'>
        <code>{sourceCode}</code>
      </pre>
    </div>
  )
}
