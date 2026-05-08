/**
 * 当前文件负责：定义主世界水面波纹类设计内容。
 */

import type { StageDesignCatalogGroup, StageDesignItem } from "../stage-design-types"

export const RIPPLE_STAGE_DESIGN_ITEMS: StageDesignItem[] = [
  {
    id: "water_surface_ripple",
    category: "water",
    label: "水面波纹",
    description:
      "湖面上的轻微动态细节，用来表现水域不是静态贴图，而是持续处于自然变化中。",
    priority: "P1",
    mvpStatus: "enabled",
    density: "low",
    placements: ["lake_side"],
    interactionRoles: ["pet_perception_source", "atmosphere_feedback"],
    timeMode: "all_day",
    visualKeywords: ["浅蓝高光", "短横线", "轻微闪动", "安静", "低存在感"],
    validationNotes: [
      "水面波纹必须轻，不应像技能特效。",
      "水面波纹不能比生命舱光效更醒目。",
      "水面波纹数量和动画由 world/entities 或 renderer 层控制，不在设计文件中决定。",
    ],
    futureHook:
      "后续天气系统增强后，雨天或风天可增加波纹活跃度；MVP 暂不执行。",
  },
]

export const RIPPLE_STAGE_DESIGN_GROUP: StageDesignCatalogGroup = {
  groupId: "water_ripple",
  label: "水面波纹类",
  description: "定义湖面波纹等水域动态细节内容。",
  items: RIPPLE_STAGE_DESIGN_ITEMS,
}