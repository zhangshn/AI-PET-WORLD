/**
 * 当前文件负责：定义主世界昆虫类数量生成规则。
 */

import type { StageSpawnRule } from "./stage-spawn-rule-types"

export const INSECT_STAGE_SPAWN_RULES: StageSpawnRule[] = [
  {
    targetDesignId: "insect_butterfly_day",
    min: 2,
    max: 4,
    defaultCount: 3,
    mode: "seeded_random",
    notes: [
      "蝴蝶数量不是固定死值。",
      "MVP 阶段控制在同屏 2 到 4 只。",
      "后续可由花草密度、天气、季节影响数量。",
    ],
  },
  {
    targetDesignId: "insect_firefly_night",
    min: 3,
    max: 8,
    defaultCount: 5,
    mode: "runtime_dynamic",
    notes: [
      "萤火虫数量不是固定死值。",
      "MVP 阶段控制在同屏 3 到 8 个光点。",
      "后续可由夜晚、季节、天气、森林边缘活跃度影响数量。",
    ],
  },
]