/**
 * 当前文件负责：推进世界文明运行状态。当前 Starter Land 阶段只记录职业需求，不自动生成 NPC。
 */

import {
  resolveProfessionNeeds,
  type ProfessionNeed,
} from "../civilization/profession-system"
import type { WorldNpcState } from "../civilization/npc-system"

export type CivilizationRuntimeState = {
  professionNeeds: ProfessionNeed[]
  npcs: WorldNpcState[]
}

export function createInitialCivilizationRuntime(): CivilizationRuntimeState {
  return {
    professionNeeds: [],
    npcs: [],
  }
}

export function stepCivilizationRuntime(input: {
  state: CivilizationRuntimeState
  tick: number
  hasHospital: boolean
  hasShop: boolean
  hasPark: boolean
  homeLevel: number
  petCount: number
}): CivilizationRuntimeState {
  const needs = resolveProfessionNeeds({
    hasHospital: input.hasHospital,
    hasShop: input.hasShop,
    hasPark: input.hasPark,
    homeLevel: input.homeLevel,
    petCount: input.petCount,
  })

  return {
    professionNeeds: needs,
    npcs: input.state.npcs,
  }
}