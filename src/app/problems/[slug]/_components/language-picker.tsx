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
    <label className='flex min-w-32 flex-1 flex-col gap-1 font-medium text-muted text-xs'>
      Language
      <select
        value={value}
        onChange={event => onChange(event.target.value as SubmissionLanguage)}
        className='field'
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
