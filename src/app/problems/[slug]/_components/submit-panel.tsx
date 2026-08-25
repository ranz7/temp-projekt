'use client'

import type { SubmissionLanguage } from '@backend/modules/task/schema'
import { useMutation } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Card } from '@/app/_components/card'
import { useTRPC } from '@/app/_trpc/config'
import { CodeEditor } from './code-editor'
import { type DroppedFileResult, EditorDropZone } from './editor-drop-zone'
import { LANGUAGE_LABELS } from './language'
import { LanguagePicker } from './language-picker'
import { readableSubmissionError } from './readable-submission-error'

type SubmitPanelProps = {
  problemSlug: string
  languages: SubmissionLanguage[]
  isSignedIn: boolean
}

/** Editor, language picker and submit button. Anonymous visitors keep the editor but cannot submit. */
export function SubmitPanel({ problemSlug, languages, isSignedIn }: SubmitPanelProps) {
  const trpc = useTRPC()
  const router = useRouter()
  const [language, setLanguage] = useState<SubmissionLanguage>(languages[0] ?? 'python')
  const [source, setSource] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const createSubmissionMutation = useMutation(
    trpc.submission.createSubmission.mutationOptions({
      onSuccess: submission => {
        router.push(`/submissions/${submission.id}`)
      }
    })
  )

  function handleFileLoaded(result: DroppedFileResult) {
    setSource(result.content)

    if (result.detectedLanguage !== null && result.detectedLanguage !== language) {
      setLanguage(result.detectedLanguage)
      setNotice(
        `Loaded "${result.fileName}" and switched the language to ${LANGUAGE_LABELS[result.detectedLanguage]}.`
      )
    } else {
      setNotice(`Loaded "${result.fileName}" into the editor.`)
    }
  }

  function handleSubmit() {
    setNotice(null)
    createSubmissionMutation.mutate({ problemSlug, language, sourceCode: source })
  }

  const errorMessage = createSubmissionMutation.isError
    ? readableSubmissionError(createSubmissionMutation.error)
    : null

  return (
    <Card>
      <div className='flex items-center justify-between gap-4'>
        <h2 className='font-semibold text-sm'>Submit a solution</h2>
        <LanguagePicker languages={languages} value={language} onChange={setLanguage} />
      </div>

      <EditorDropZone onFileLoaded={handleFileLoaded} onFileRejected={setNotice}>
        <CodeEditor language={language} value={source} onChange={setSource} />
      </EditorDropZone>

      {notice !== null ? <p className='text-muted text-xs'>{notice}</p> : null}
      {errorMessage !== null ? (
        <p role='alert' className='text-danger text-sm'>
          {errorMessage}
        </p>
      ) : null}

      {isSignedIn ? (
        <button
          type='button'
          onClick={handleSubmit}
          disabled={createSubmissionMutation.isPending || source.trim().length === 0}
          className='self-start rounded-lg bg-accent px-4 py-2 font-medium text-accent-foreground text-sm disabled:opacity-60'
        >
          {createSubmissionMutation.isPending ? 'Submitting…' : 'Submit'}
        </button>
      ) : (
        <div className='flex flex-wrap items-center gap-2'>
          <button
            type='button'
            disabled
            className='rounded-lg bg-accent px-4 py-2 font-medium text-accent-foreground text-sm opacity-60'
          >
            Submit
          </button>
          <p className='text-muted text-sm'>
            <Link href='/login' className='text-accent underline'>
              Log in
            </Link>{' '}
            to submit a solution.
          </p>
        </div>
      )}
    </Card>
  )
}
