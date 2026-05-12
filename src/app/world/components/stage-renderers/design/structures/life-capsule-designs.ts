/**
 * 当前文件负责：定义主世界初始宠物抵达照护点的设计内容。
 */

import type {
  StageDesignCatalogGroup,
  StageDesignItem,
} from "../stage-design-types"

export const LIFE_CAPSULE_STAGE_DESIGN_ITEMS: StageDesignItem[] = [
  {
    id: "structure_life_capsule",
    category: "structure",
    label: "宠物抵达照护点",
    description:
      "主世界最重要的视觉中心之一。宠物抵达前，它表达领养中心分配与送达准备；宠物抵达后，它作为家园的抵达记忆点保留。",
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
      "抵达记忆点",
      "呼吸光",
      "环形底座",
      "温暖科技感",
      "领养送达感",
    ],
    validationNotes: [
      "宠物抵达照护点必须在初始视野内。",
      "宠物抵达照护点不能被树木、小屋、前景氛围或 UI 遮挡。",
      "宠物抵达照护点光效可以醒目，但不能像战斗技能特效。",
      "宠物抵达照护点的具体位置由 world/map 或结构布局层决定，不在设计文件中生成。",
    ],
    futureHook:
      "后续可根据宠物生命阶段、领养抵达状态、家园等级改变照护点外观；MVP 先固定基础形态。",
  },
]

export const LIFE_CAPSULE_STAGE_DESIGN_GROUP: StageDesignCatalogGroup = {
  groupId: "structure_life_capsule",
  label: "宠物抵达照护点",
  description: "定义初始宠物抵达照护点等主世界核心生命装置内容。",
  items: LIFE_CAPSULE_STAGE_DESIGN_ITEMS,
}
