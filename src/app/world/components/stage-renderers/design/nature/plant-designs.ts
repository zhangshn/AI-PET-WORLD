/**
 * 当前文件负责：定义主世界普通植物类设计内容。
 */

import type { StageDesignCatalogGroup, StageDesignItem } from "../stage-design-types"

export const PLANT_STAGE_DESIGN_ITEMS: StageDesignItem[] = [
  {
    id: "plant_grass_clump",
    category: "plant",
    label: "小草簇",
    description:
      "用于打破草地单调感，表现微风、生态细节和自然生长感。",
    priority: "P1",
    mvpStatus: "enabled",
    density: "medium",
    placements: ["core_courtyard", "forest_edge", "lake_side", "path_side"],
    interactionRoles: ["visual_only", "atmosphere_feedback"],
    timeMode: "all_day",
    visualKeywords: ["草叶", "细碎", "微风", "生态", "低对比"],
    validationNotes: [
      "小草簇颜色必须弱于宠物、管家和生命舱。",
      "小草簇不能覆盖路径边界。",
      "小草簇应该服务自然氛围，不能变成视觉噪点。",
    ],
  },
  {
    id: "plant_courtyard_greenery",
    category: "plant",
    label: "庭院植物",
    description:
      "放在小屋、生命舱和管家记录场景附近，用来营造有人照看的生活空间。",
    priority: "P1",
    mvpStatus: "enabled",
    density: "low",
    placements: ["core_courtyard", "home_area", "path_side"],
    interactionRoles: ["visual_only", "home_progress_anchor"],
    timeMode: "all_day",
    visualKeywords: ["小盆栽", "庭院", "生活感", "被照看", "温暖"],
    validationNotes: [
      "庭院植物不能太多，避免让家园区域像农场。",
      "庭院植物应靠近生活空间，不应随机撒满地图。",
      "庭院植物可以强化家园建设感，但不能变成玩法主线。",
    ],
  },
  {
    id: "plant_lake_reed",
    category: "plant",
    label: "湖边水草",
    description:
      "放在浅水湖边缘，用于表现湖边生态、水声来源和宠物观察点。",
    priority: "P1",
    mvpStatus: "enabled",
    density: "low",
    placements: ["lake_side"],
    interactionRoles: ["visual_only", "pet_perception_source", "atmosphere_feedback"],
    timeMode: "all_day",
    visualKeywords: ["水草", "湖边", "轻微摆动", "湿润", "安静"],
    validationNotes: [
      "湖边水草不能铺满湖岸。",
      "湖边水草不能挡住湖面波纹。",
      "湖边水草应辅助水域层次，不作为主要视觉中心。",
    ],
  },
]

export const PLANT_STAGE_DESIGN_GROUP: StageDesignCatalogGroup = {
  groupId: "nature_plant",
  label: "植物类",
  description: "定义小草簇、庭院植物、湖边水草等普通植物内容。",
  items: PLANT_STAGE_DESIGN_ITEMS,
}
