import type { SubmissionLanguage } from '@backend/modules/task/schema'

/** Readable label for each language the editor and ranking can show. */
export const LANGUAGE_LABELS: Record<SubmissionLanguage, string> = {
  python: 'Python',
  cpp: 'C++'
}

/** Monaco's own language id for each supported language. */
export const MONACO_LANGUAGE_IDS: Record<SubmissionLanguage, string> = {
  python: 'python',
  cpp: 'cpp'
}

const EXTENSION_LANGUAGES: Record<string, SubmissionLanguage> = {
  py: 'python',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  c: 'cpp'
}

/** The language a file extension names, or null when it does not match one of ours. */
export function languageForFileName(fileName: string): SubmissionLanguage | null {
  const dotIndex = fileName.lastIndexOf('.')
  if (dotIndex === -1) {
    return null
  }

  const extension = fileName.slice(dotIndex + 1).toLowerCase()
  return EXTENSION_LANGUAGES[extension] ?? null
}
