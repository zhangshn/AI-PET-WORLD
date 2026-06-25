import type { VisualUnitActionState, VisualUnitLifecycleState, VisualUnitType } from "./visual-unit-schema"

export type VisualUnitRuntimeBinding = {
  worldId: string
  tick: number
  sourceFactIds: string[]
}

export type VisualUnitRuntimeFrame = {
  runtimeFrameId: string
  unitId: string
  unitType: VisualUnitType
  lifecycleState: VisualUnitLifecycleState
  actionState: VisualUnitActionState
  binding: VisualUnitRuntimeBinding
  approvedFrameId: string | null
  canShowToPlayer: boolean
  blockedReason: string | null
}

export function buildBlockedVisualUnitRuntimeFrame(input: {
  runtimeFrameId: string
  unitId: string
  unitType: VisualUnitType
  lifecycleState: VisualUnitLifecycleState
  actionState: VisualUnitActionState
  binding: VisualUnitRuntimeBinding
  blockedReason: string
}): VisualUnitRuntimeFrame {
  return {
    runtimeFrameId: input.runtimeFrameId,
    unitId: input.unitId,
    unitType: input.unitType,
    lifecycleState: input.lifecycleState,
    actionState: input.actionState,
    binding: input.binding,
    approvedFrameId: null,
    canShowToPlayer: false,
    blockedReason: input.blockedReason,
  }
}
