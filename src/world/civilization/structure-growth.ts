/**
 * 当前文件负责：定义世界建筑成长阶段与基础扩建规则。
 */

export type StructureType =
  | "home"
  | "incubator"
  | "hospital"
  | "shop"
  | "park"

export type StructureGrowthState = {
  type: StructureType
  level: number
  progress: number
  completed: boolean
}

export function advanceStructureGrowth(input: {
  structure: StructureGrowthState
  buildPower: number
}): StructureGrowthState {
  if (input.structure.completed && input.structure.progress >= 100) {
    return input.structure
  }

  const nextProgress = Math.min(
    100,
    input.structure.progress + input.buildPower
  )

  return {
    ...input.structure,
    progress: nextProgress,
    completed: nextProgress >= 100,
    level: nextProgress >= 100
      ? Math.max(input.structure.level, 1)
      : input.structure.level,
  }
}