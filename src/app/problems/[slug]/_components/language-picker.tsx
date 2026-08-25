'use client'

import type { SubmissionLanguage } from '@backend/modules/task/schema'
import { LANGUAGE_LABELS } from './language'

type LanguagePickerProps = {
  languages: SubmissionLanguage[]
  value: SubmissionLanguage
  onChange: (language: SubmissionLanguage) => void
}

/** Python and C++ only - the only two languages any problem in this judge accepts. */
export function LanguagePicker({ languages, value, onChange }: LanguagePickerProps) {
  return (
    <label className='flex flex-col gap-1.5 text-sm'>
      <span className='font-medium'>Language</span>
      <select
        value={value}
        onChange={event => onChange(event.target.value as SubmissionLanguage)}
        className='rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent'
      >
        {languages.map(language => (
          <option key={language} value={language}>
            {LANGUAGE_LABELS[language]}
          </option>
        ))}
      </select>
    </label>
  )
}
