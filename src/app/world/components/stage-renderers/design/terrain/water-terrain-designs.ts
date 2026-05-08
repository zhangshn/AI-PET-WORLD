/**
 * 当前文件负责：定义主世界水域地形类设计内容。
 */

import type { StageDesignCatalogGroup, StageDesignItem } from "../stage-design-types"

export const WATER_TERRAIN_STAGE_DESIGN_ITEMS: StageDesignItem[] = [
  {
    id: "terrain_shallow_water",
    category: "terrain",
    label: "浅水地形",
    description:
      "浅水湖和湖边过渡区域的基础地形，为水声、波纹、倒影和宠物观察提供空间。",
    priority: "P0",
    mvpStatus: "enabled",
    density: "medium",
    placements: ["lake_side", "background"],
    interactionRoles: ["pet_perception_source", "atmosphere_feedback", "visual_only"],
    timeMode: "all_day",
    visualKeywords: ["浅蓝", "安静", "清澈", "湖边", "轻波纹"],
    validationNotes: [
      "浅水区域不能占据核心庭院。",
      "浅水区域不能太大，避免主世界变成水域地图。",
      "湖边必须留出宠物观察点。",
    ],
  },
]

export const WATER_TERRAIN_STAGE_DESIGN_GROUP: StageDesignCatalogGroup = {
  groupId: "terrain_water",
  label: "水域地形类",
  description: "定义浅水地形和湖边过渡地形。",
  items: WATER_TERRAIN_STAGE_DESIGN_ITEMS,
}