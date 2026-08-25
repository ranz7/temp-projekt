import { z } from 'zod'

/** How many rows a ranking returns when the caller does not say. */
export const RANKING_LIMIT_DEFAULT = 100

/** Hard ceiling on a single ranking page, so one call cannot walk the whole table. */
export const RANKING_LIMIT_MAX = 200

export const RankingLimitZ = z
  .number()
  .int()
  .min(1)
  .max(RANKING_LIMIT_MAX)
  .default(RANKING_LIMIT_DEFAULT)
