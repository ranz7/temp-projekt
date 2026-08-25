import { machine__machine_ } from '@backend/modules/machine/schema'
import { submission__submission_ } from '@backend/modules/submission/schema'
import { publicProcedure } from '@backend/trpc'
import { asc, eq, sql } from 'drizzle-orm'
import { ListMachinesOutputDTOZ } from './output.dto'

/**
 * Every machine, with how many submissions it is judging right now. Open to anyone who
 * knows the address: this deployment's panel has no sign-in, on purpose.
 */
export const listMachinesProcedure = publicProcedure
  .meta({ operation: 'machine.listMachines', procedureKind: 'query' })
  .output(ListMachinesOutputDTOZ)
  .query(async ({ ctx }) => {
    const judgingNow = ctx.db.$with('judging_now_').as(
      ctx.db
        .select({
          machineId: submission__submission_.machine_id_,
          held: sql<number>`count(*)::int`.as('held_')
        })
        .from(submission__submission_)
        .where(eq(submission__submission_.status_, 'running'))
        .groupBy(submission__submission_.machine_id_)
    )

    const rows = await ctx.db
      .with(judgingNow)
      .select({
        id: machine__machine_.id,
        name: machine__machine_.name_,
        address: machine__machine_.address_,
        localPort: machine__machine_.local_port_,
        enabled: machine__machine_.enabled_,
        reachable: machine__machine_.reachable_,
        capacity: machine__machine_.capacity_,
        busy: machine__machine_.busy_,
        judgingNow: sql<number>`coalesce(${judgingNow.held}, 0)::int`,
        judgedTotal: machine__machine_.judged_total_,
        version: machine__machine_.version_,
        problems: machine__machine_.problems_,
        lastSeenAt: machine__machine_.last_seen_at_,
        lastError: machine__machine_.last_error_,
        createdAt: machine__machine_.created_at_
      })
      .from(machine__machine_)
      .leftJoin(judgingNow, eq(judgingNow.machineId, machine__machine_.id))
      .orderBy(asc(machine__machine_.name_))

    return { machines: rows }
  })
