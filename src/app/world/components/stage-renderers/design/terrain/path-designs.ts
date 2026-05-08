/**
 * 当前文件负责：定义主世界路径类设计内容。
 */

import type { StageDesignCatalogGroup, StageDesignItem } from "../stage-design-types"

export const PATH_STAGE_DESIGN_ITEMS: StageDesignItem[] = [
  {
    id: "terrain_soft_path",
    category: "terrain",
    label: "柔和土路",
    description:
      "连接生命舱、小屋、湖边、花草区和公告栏的基础路径，让玩家一眼看懂世界结构。",
    priority: "P0",
    mvpStatus: "enabled",
    density: "medium",
    placements: ["core_courtyard", "home_area", "lake_side", "flower_slope"],
    interactionRoles: ["movement_guidance", "visual_only"],
    timeMode: "all_day",
    visualKeywords: ["浅棕", "柔和", "可行走", "路径引导", "庭院连接"],
    validationNotes: [
      "路径必须连接核心区域和主要观察点。",
      "路径不能切碎核心庭院。",
      "路径颜色要低调，不抢生命舱和角色。",
    ],
  },
  {
    id: "terrain_wooden_path",
    category: "terrain",
    label: "木板路",
    description:
      "家园门口、生命舱附近和湖边的结构化路径，用来强化生活空间和手工建设感。",
    priority: "P0",
    mvpStatus: "enabled",
    density: "low",
    placements: ["home_area", "life_capsule_area", "lake_side", "path_side"],
    interactionRoles: ["movement_guidance", "home_progress_anchor", "visual_only"],
    timeMode: "all_day",
    visualKeywords: ["木质", "温暖", "生活感", "轻建设", "路线清晰"],
    validationNotes: [
      "木板路数量不能太多，否则会像经营建设游戏。",
      "木板路应该强调家园入口和生命舱周边。",
      "木板路不能遮挡宠物活动空间。",
    ],
  },
]

export const PATH_STAGE_DESIGN_GROUP: StageDesignCatalogGroup = {
  groupId: "terrain_path",
  label: "路径类",
  description: "定义土路、木板路等主世界路线引导内容。",
  items: PATH_STAGE_DESIGN_ITEMS,
}