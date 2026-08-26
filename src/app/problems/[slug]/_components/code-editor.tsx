'use client'

import type { SubmissionLanguage } from '@backend/modules/task/schema'
import Editor from '@monaco-editor/react'
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
    <div className='monaco-wrap'>
      <Editor
        height='100%'
        language={MONACO_LANGUAGE_IDS[language]}
        value={value}
        theme={theme === 'dark' ? 'vs-dark' : 'vs'}
        onChange={next => onChange(next ?? '')}
        loading={<div className='monaco-loading'>Loading editor...</div>}
        options={{
          minimap: { enabled: false },
          wordWrap: 'on',
          fontSize: 14,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          tabSize: 4,
          automaticLayout: true,
          scrollBeyondLastLine: false,
          padding: { top: 12, bottom: 12 },
          renderLineHighlight: 'line'
        }}
      />
    </div>
  )
}
