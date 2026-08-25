'use client'

import type { SubmissionLanguage } from '@backend/modules/task/schema'
import Editor from '@monaco-editor/react'
import { Skeleton } from '@/app/_components/skeleton'
import { useSiteTheme } from '../_hooks/use-site-theme'
import { MONACO_LANGUAGE_IDS } from './language'

type CodeEditorProps = {
  language: SubmissionLanguage
  value: string
  onChange: (value: string) => void
}

/**
 * Monaco, themed to match the site. Loading is handled by the package's own
 * dynamic loader - the `loading` prop is the real placeholder shown until it
 * is ready, so the server render never needs Monaco itself.
 */
export function CodeEditor({ language, value, onChange }: CodeEditorProps) {
  const theme = useSiteTheme()

  return (
    <div className='h-96 w-full overflow-hidden rounded-lg border border-border'>
      <Editor
        height='100%'
        language={MONACO_LANGUAGE_IDS[language]}
        value={value}
        theme={theme === 'dark' ? 'vs-dark' : 'vs'}
        onChange={next => onChange(next ?? '')}
        loading={<Skeleton className='h-full w-full rounded-none' />}
        options={{
          minimap: { enabled: false },
          wordWrap: 'on',
          fontSize: 14,
          tabSize: 4,
          automaticLayout: true,
          scrollBeyondLastLine: false
        }}
      />
    </div>
  )
}
