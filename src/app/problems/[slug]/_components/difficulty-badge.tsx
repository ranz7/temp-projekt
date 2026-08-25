import type { ProblemDifficulty } from '@backend/modules/task/schema'
import { cn } from '@/app/_components/cn'

const DIFFICULTY_LABELS: Record<ProblemDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard'
}

const DIFFICULTY_CLASSES: Record<ProblemDifficulty, string> = {
  easy: 'bg-status-green/15 text-status-green',
  medium: 'bg-status-amber/15 text-status-amber',
  hard: 'bg-status-red/15 text-status-red'
}

/** Colour-coded difficulty pill, keyed to the same accent palette as submission statuses. */
export function DifficultyBadge({ difficulty }: { difficulty: ProblemDifficulty }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 font-medium text-xs',
        DIFFICULTY_CLASSES[difficulty]
      )}
    >
      {DIFFICULTY_LABELS[difficulty]}
    </span>
  )
}
