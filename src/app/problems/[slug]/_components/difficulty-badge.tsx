import type { ProblemDifficulty } from '@backend/modules/task/schema'
import { cn } from '@/app/_components/cn'

const DIFFICULTY_LABELS: Record<ProblemDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard'
}

const DIFFICULTY_CLASSES: Record<ProblemDifficulty, string> = {
  easy: 'bg-tint-green text-tint-green-ink ring-tint-green-ring',
  medium: 'bg-tint-amber text-tint-amber-ink ring-tint-amber-ring',
  hard: 'bg-tint-red text-tint-red-ink ring-tint-red-ring'
}

/** Colour-coded difficulty pill, keyed to the same accent palette as submission statuses. */
export function DifficultyBadge({ difficulty }: { difficulty: ProblemDifficulty }) {
  return (
    <span className={cn('badge', DIFFICULTY_CLASSES[difficulty])}>
      {DIFFICULTY_LABELS[difficulty]}
    </span>
  )
}
