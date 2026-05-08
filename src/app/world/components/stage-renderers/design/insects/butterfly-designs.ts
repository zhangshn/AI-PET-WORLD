/**
 * 当前文件负责：定义主世界蝴蝶类设计内容。
 */

import type { StageDesignCatalogGroup, StageDesignItem } from "../stage-design-types"

export const BUTTERFLY_STAGE_DESIGN_ITEMS: StageDesignItem[] = [
  {
    id: "insect_butterfly_day",
    category: "insect",
    label: "蝴蝶",
    description:
      "白天出现在花草坡地、湖边和庭院边缘的小型生命动态元素，用来强化主世界正在自然运行的感觉。",
    priority: "P0",
    mvpStatus: "enabled",
    density: "low",
    placements: ["flower_slope", "lake_side", "core_courtyard"],
    interactionRoles: ["pet_perception_source", "atmosphere_feedback"],
    timeMode: "daytime",
    spawnRule: {
      min: 2,
      max: 4,
      defaultCount: 3,
      mode: "seeded_random",
    },
    visualKeywords: ["小型", "轻微浮动", "粉色", "黄色", "浅蓝", "花草区"],
    validationNotes: [
      "蝴蝶数量应控制在同屏 2 到 4 只。",
      "蝴蝶不能比宠物更醒目。",
      "蝴蝶运动范围要小，不能让画面显得混乱。",
      "蝴蝶应优先围绕花草区域，而不是全图乱飞。",
      "蝴蝶数量不是固定死值，而是由 spawnRule 控制在安全范围内。",
    ],
    seasonalHook:
      "后续季节系统接入后，春夏蝴蝶更活跃，秋季减少，冬季基本隐藏；MVP 暂不执行。",
  },
]

export const BUTTERFLY_STAGE_DESIGN_GROUP: StageDesignCatalogGroup = {
  groupId: "insect_butterfly",
  label: "蝴蝶类",
  description: "定义主世界白天蝴蝶动态元素。",
  items: BUTTERFLY_STAGE_DESIGN_ITEMS,
}