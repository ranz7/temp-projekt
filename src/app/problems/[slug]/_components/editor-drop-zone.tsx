'use client'

import type { SubmissionLanguage } from '@backend/modules/task/schema'
import { type ChangeEvent, type DragEvent, type ReactNode, useRef, useState } from 'react'
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
 * A solution taken from a file, either dropped onto the editor or picked from
 * disk. Files over 2 MB are refused with a readable message instead of being
 * loaded. Returns the wrapper to put around the editor, and the button that
 * opens the file picker - the caller decides where that button sits.
 */
export function useSolutionFile({
  onFileLoaded,
  onFileRejected
}: Omit<EditorDropZoneProps, 'children'>) {
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

  return {
    isDraggingOver,
    /** Spread onto the element wrapping the editor. */
    dropZoneProps: {
      onDragOver: (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault()
        setIsDraggingOver(true)
      },
      onDragLeave: () => setIsDraggingOver(false),
      onDrop: handleDrop
    },
    /** Opens the file picker - wire it to a button of the caller's own. */
    openFilePicker: () => fileInputRef.current?.click(),
    /** Render once, anywhere: the hidden input the picker opens. */
    fileInput: (
      <input
        ref={fileInputRef}
        type='file'
        className='hidden'
        onChange={handleFileInputChange}
        aria-label='Choose a solution file'
      />
    )
  }
}
