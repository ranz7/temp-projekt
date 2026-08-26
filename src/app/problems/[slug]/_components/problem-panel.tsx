'use client'

import type { ProblemRankingRowDTO } from '@backend/modules/ranking/endpoints/queries/get-problem-ranking/output.dto'
import type { SubmissionLanguage } from '@backend/modules/task/schema'
import { useState } from 'react'
import { cn } from '@/app/_components/cn'
import { ProblemRanking } from './problem-ranking'
import { ProblemSubmissionsPanel } from './problem-submissions-panel'
import { SubmitPanel } from './submit-panel'

type Tab = 'submit' | 'submissions' | 'ranking'

type ProblemPanelProps = {
  problemSlug: string
  languages: SubmissionLanguage[]
  isSignedIn: boolean
  ranking: ProblemRankingRowDTO[]
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'submit', label: 'Submit' },
  { key: 'submissions', label: 'My submissions' },
  { key: 'ranking', label: 'Ranking' }
]

/** The working half of a problem page: write a solution, watch it, see who solved it. */
export function ProblemPanel({ problemSlug, languages, isSignedIn, ranking }: ProblemPanelProps) {
  const [tab, setTab] = useState<Tab>('submit')

  return (
    <aside className='problem-detail-panel card'>
      <div className='flex border-divider border-b' role='tablist'>
        {TABS.map(entry => (
          <button
            key={entry.key}
            type='button'
            role='tab'
            aria-selected={tab === entry.key}
            className={cn('panel-tab', tab === entry.key && 'panel-tab--active')}
            onClick={() => setTab(entry.key)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className='relative min-h-0 flex-1 overflow-auto'>
        {tab === 'submit' ? (
          <SubmitPanel problemSlug={problemSlug} languages={languages} isSignedIn={isSignedIn} />
        ) : null}
        {tab === 'submissions' ? (
          isSignedIn ? (
            <ProblemSubmissionsPanel problemSlug={problemSlug} />
          ) : (
            <p className='p-6 text-muted text-sm'>Log in to see your own attempts.</p>
          )
        ) : null}
        {tab === 'ranking' ? <ProblemRanking rows={ranking} /> : null}
      </div>
    </aside>
  )
}
