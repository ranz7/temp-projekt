'use client'

import type { ListMachinesOutputDTO } from '@backend/modules/machine/endpoints/queries/list-machines/output.dto'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/app/_components/cn'
import { useTRPC } from '@/app/_trpc/config'

type MachineToggleProps = {
  machineId: string
  enabled: boolean
}

/**
 * Turns one machine on or off. Flips the switch and the list it lives in immediately,
 * then reconciles with whatever the server actually saved - including flipping back if
 * the call fails.
 */
export function MachineToggle({ machineId, enabled }: MachineToggleProps) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const listKey = trpc.machine.listMachines.queryKey()

  const setEnabledMutation = useMutation(
    trpc.machine.setMachineEnabled.mutationOptions({
      onMutate: async input => {
        await queryClient.cancelQueries({ queryKey: listKey })
        const previous = queryClient.getQueryData<ListMachinesOutputDTO>(listKey)

        queryClient.setQueryData<ListMachinesOutputDTO>(listKey, current =>
          current === undefined
            ? current
            : {
                machines: current.machines.map(machine =>
                  machine.id === input.machineId ? { ...machine, enabled: input.enabled } : machine
                )
              }
        )

        return { previous }
      },
      onError: (_error, _input, context) => {
        if (context?.previous !== undefined) {
          queryClient.setQueryData(listKey, context.previous)
        }
      },
      onSettled: () => {
        void queryClient.invalidateQueries({ queryKey: listKey })
      }
    })
  )

  const nextEnabled = !enabled

  return (
    <button
      type='button'
      role='switch'
      aria-checked={enabled}
      disabled={setEnabledMutation.isPending}
      onClick={() => setEnabledMutation.mutate({ machineId, enabled: nextEnabled })}
      className={cn(
        'rounded-lg border px-3 py-1.5 font-medium text-sm disabled:opacity-60',
        enabled
          ? 'border-border hover:bg-placeholder'
          : 'border-accent bg-accent text-accent-foreground'
      )}
    >
      {enabled ? 'Disable' : 'Enable'}
    </button>
  )
}
