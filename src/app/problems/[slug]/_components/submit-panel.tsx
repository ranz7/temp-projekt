'use client'

import type { SubmissionLanguage } from '@backend/modules/task/schema'
import { useMutation } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/app/_components/cn'
import { useTRPC } from '@/app/_trpc/config'
import { CodeEditor } from './code-editor'
import { type DroppedFileResult, useSolutionFile } from './editor-drop-zone'
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

  const { isDraggingOver, dropZoneProps, openFilePicker, fileInput } = useSolutionFile({
    onFileLoaded: handleFileLoaded,
    onFileRejected: setNotice
  })

  const errorMessage = createSubmissionMutation.isError
    ? readableSubmissionError(createSubmissionMutation.error)
    : null

  return (
    <div className='submit-form'>
      <div className='flex flex-wrap items-end gap-3'>
        <LanguagePicker languages={languages} value={language} onChange={setLanguage} />
        <button type='button' onClick={openFilePicker} className='btn-secondary'>
          Attach file
        </button>
        {fileInput}
        {isSignedIn ? (
          <button
            type='button'
            onClick={handleSubmit}
            disabled={createSubmissionMutation.isPending || source.trim().length === 0}
            className='btn-primary'
          >
            {createSubmissionMutation.isPending ? 'Submitting...' : 'Submit'}
          </button>
        ) : (
          <button type='button' disabled className='btn-primary'>
            Submit
          </button>
        )}
      </div>

      {isSignedIn ? null : (
        <p className='text-muted text-xs'>
          <Link href='/login' className='text-accent hover:underline'>
            Log in
          </Link>{' '}
          to submit a solution.
        </p>
      )}

      <div className='submit-editor-block'>
        <div className='mb-1 flex items-center justify-between font-medium text-muted text-xs'>
          <span>Source code</span>
          <span className='font-normal text-meta'>Type here, or drop a file onto it</span>
        </div>
        {/* Dropping a file is mouse-only by nature; "Attach file" above is the
            keyboard-reachable equivalent. */}
        <div
          {...dropZoneProps}
          className={cn(
            'flex min-h-0 flex-1 flex-col rounded-md outline-2 outline-dashed outline-transparent transition-colors',
            isDraggingOver && 'outline-accent'
          )}
        >
          <CodeEditor language={language} value={source} onChange={setSource} />
        </div>
      </div>

      {notice !== null ? <p className='text-muted text-xs'>{notice}</p> : null}
      {errorMessage !== null ? (
        <p role='alert' className='font-medium text-danger text-xs'>
          {errorMessage}
        </p>
      ) : null}
    </div>
  )
}
