/**
 * 当前文件负责：定义主世界萤火虫类设计内容。
 */

import type { StageDesignCatalogGroup, StageDesignItem } from "../stage-design-types"

export const FIREFLY_STAGE_DESIGN_ITEMS: StageDesignItem[] = [
  {
    id: "insect_firefly_night",
    category: "insect",
    label: "萤火虫",
    description:
      "夜间出现在森林边缘、湖边和花草区的小型微光生命元素，用来让夜晚不只是变暗，而是仍然有生命活动。",
    priority: "P0",
    mvpStatus: "enabled",
    density: "low",
    placements: ["forest_edge", "lake_side", "flower_slope", "night_only"],
    interactionRoles: ["pet_perception_source", "atmosphere_feedback"],
    timeMode: "night",
    visualKeywords: ["夜间", "微光", "黄绿色光点", "轻微闪烁", "安静"],
    validationNotes: [
      "萤火虫只应该在夜间明显出现。",
      "萤火虫亮度不能高过生命舱核心光效。",
      "萤火虫应服务夜间氛围，不应像技能特效。",
      "萤火虫数量不在定义文件中决定，由 rules/spawn 层控制。",
    ],
    futureHook:
      "后续季节系统接入后，夏季夜晚萤火虫更活跃，春秋较少，冬季基本隐藏；MVP 暂不执行。",
  },
]

export const FIREFLY_STAGE_DESIGN_GROUP: StageDesignCatalogGroup = {
  groupId: "insect_firefly",
  label: "萤火虫类",
  description: "定义主世界夜间萤火虫微光元素。",
  items: FIREFLY_STAGE_DESIGN_ITEMS,
}