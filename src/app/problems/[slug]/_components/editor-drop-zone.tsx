'use client'

import type { SubmissionLanguage } from '@backend/modules/task/schema'
import { type ChangeEvent, type DragEvent, type ReactNode, useRef, useState } from 'react'
import { cn } from '@/app/_components/cn'
import { languageForFileName } from './language'

const MAX_FILE_BYTES = 2 * 1024 * 1024

export type DroppedFileResult = {
  fileName: string
  content: string
  detectedLanguage: SubmissionLanguage | null
}

type EditorDropZoneProps = {
  children: ReactNode
  onFileLoaded: (result: DroppedFileResult) => void
  onFileRejected: (message: string) => void
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.readAsText(file)
  })
}

/**
 * Wraps the editor so a file can be dropped onto it or picked from disk,
 * replacing the editor's content. Files over 2 MB are refused with a
 * readable message instead of being loaded.
 */
export function EditorDropZone({ children, onFileLoaded, onFileRejected }: EditorDropZoneProps) {
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function loadFile(file: File) {
    if (file.size > MAX_FILE_BYTES) {
      onFileRejected(`"${file.name}" is too large - a solution may be at most 2 MB.`)
      return
    }

    try {
      const content = await readFileAsText(file)
      onFileLoaded({
        fileName: file.name,
        content,
        detectedLanguage: languageForFileName(file.name)
      })
    } catch {
      onFileRejected(`Could not read "${file.name}".`)
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDraggingOver(false)
    const file = event.dataTransfer.files[0]
    if (file !== undefined) {
      void loadFile(file)
    }
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file !== undefined) {
      void loadFile(file)
    }
  }

  return (
    <div className='flex flex-col gap-2'>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop is mouse-only by nature; the "Choose file" button below is the keyboard-reachable equivalent */}
      <div
        onDragOver={event => {
          event.preventDefault()
          setIsDraggingOver(true)
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={handleDrop}
        className={cn(
          'rounded-lg outline-2 outline-dashed outline-transparent transition-colors',
          isDraggingOver && 'outline-accent'
        )}
      >
        {children}
      </div>
      <div className='flex items-center gap-2'>
        <button
          type='button'
          onClick={() => fileInputRef.current?.click()}
          className='self-start rounded-lg border border-border px-3 py-1.5 font-medium text-xs hover:bg-placeholder'
        >
          Choose file
        </button>
        <p className='text-muted text-xs'>or drop a file onto the editor - up to 2 MB</p>
      </div>
      <input
        ref={fileInputRef}
        type='file'
        className='hidden'
        onChange={handleFileInputChange}
        aria-label='Choose a solution file'
      />
    </div>
  )
}
