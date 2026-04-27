/**
 * 当前文件负责：生成早期系统 NPC，并为未来玩家/管家接管职业留下结构。
 */

import type { WorldProfessionType, ProfessionNeed } from "./profession-system"
import type { WorldPosition } from "../map/world-map"

export type WorldNpcState = {
  id: string
  name: string
  profession: WorldProfessionType
  temporary: boolean
  canBeReplacedByButler: boolean
  position: WorldPosition
  createdAtTick: number
}

export function createSystemNpc(input: {
  need: ProfessionNeed
  tick: number
  position: WorldPosition
}): WorldNpcState {
  const nameMap: Record<WorldProfessionType, string> = {
    doctor: "系统医生",
    architect: "系统建筑师",
    merchant: "系统商人",
    gardener: "系统园丁",
    caretaker: "系统照看员",
  }

  return {
    id: `npc-${input.need.type}-${input.tick}`,
    name: nameMap[input.need.type],
    profession: input.need.type,
    temporary: true,
    canBeReplacedByButler: true,
    position: input.position,
    createdAtTick: input.tick,
  }
}