/**
 * 当前文件负责：定义主世界生命舱类设计内容。
 */

import type { StageDesignCatalogGroup, StageDesignItem } from "../stage-design-types"

export const LIFE_CAPSULE_STAGE_DESIGN_ITEMS: StageDesignItem[] = [
  {
    id: "structure_life_capsule",
    category: "structure",
    label: "生命舱 / 孵化器",
    description:
      "主世界最重要的视觉中心之一。宠物出生前，它是胚胎孵化与生命开始的核心；宠物出生后，它仍然作为家园的生命装置保留。",
    priority: "P0",
    mvpStatus: "enabled",
    density: "very_low",
    placements: ["core_courtyard", "life_capsule_area", "home_area"],
    interactionRoles: [
      "butler_work_target",
      "home_progress_anchor",
      "atmosphere_feedback",
    ],
    timeMode: "all_day",
    visualKeywords: [
      "蓝绿色玻璃",
      "生命核心",
      "呼吸光",
      "环形底座",
      "温暖科技感",
      "孵化感",
    ],
    validationNotes: [
      "生命舱必须在初始视野内。",
      "生命舱不能被树木、小屋、前景氛围或 UI 遮挡。",
      "生命舱光效可以醒目，但不能像战斗技能特效。",
      "生命舱的具体位置由 world/map 或结构布局层决定，不在设计文件中生成。",
    ],
    futureHook:
      "后续可根据宠物生命阶段、孵化稳定度、家园等级改变生命舱外观；MVP 先固定基础形态。",
  },
]

export const LIFE_CAPSULE_STAGE_DESIGN_GROUP: StageDesignCatalogGroup = {
  groupId: "structure_life_capsule",
  label: "生命舱类",
  description: "定义生命舱、孵化器等主世界核心生命装置内容。",
  items: LIFE_CAPSULE_STAGE_DESIGN_ITEMS,
}