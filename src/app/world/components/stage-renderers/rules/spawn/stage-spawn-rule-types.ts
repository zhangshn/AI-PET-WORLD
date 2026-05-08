/**
 * 当前文件负责：定义主世界物品数量生成规则类型。
 */

export type StageSpawnMode =
  | "fixed"
  | "seeded_random"
  | "runtime_dynamic"

export type StageSpawnRule = {
  targetDesignId: string
  min: number
  max: number
  defaultCount: number
  mode: StageSpawnMode
  notes: string[]
}