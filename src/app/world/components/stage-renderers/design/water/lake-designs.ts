/**
 * 当前文件负责：定义主世界湖泊类设计内容。
 */

import type { StageDesignCatalogGroup, StageDesignItem } from "../stage-design-types"

export const LAKE_STAGE_DESIGN_ITEMS: StageDesignItem[] = [
  {
    id: "water_shallow_lake",
    category: "water",
    label: "浅水湖",
    description:
      "主世界中的自然水域区域，为水声、湿润感、倒影、宠物观察和夜间氛围提供基础场景。",
    priority: "P0",
    mvpStatus: "enabled",
    density: "medium",
    placements: ["lake_side", "background"],
    interactionRoles: ["pet_perception_source", "atmosphere_feedback"],
    timeMode: "all_day",
    visualKeywords: ["浅蓝", "清澈", "安静", "倒影", "水声", "自然边界"],
    validationNotes: [
      "浅水湖不能占据核心庭院。",
      "浅水湖不能过大，避免主世界变成水域地图。",
      "浅水湖边缘需要保留宠物观察点。",
      "浅水湖的位置和形状由 world/map 层决定，不在设计文件中生成。",
    ],
    futureHook:
      "后续季节系统接入后，冬季可降低水面活跃感，雨季可增强水面反光；MVP 暂不执行。",
  },
]

export const LAKE_STAGE_DESIGN_GROUP: StageDesignCatalogGroup = {
  groupId: "water_lake",
  label: "湖泊类",
  description: "定义浅水湖等主世界自然水域内容。",
  items: LAKE_STAGE_DESIGN_ITEMS,
}