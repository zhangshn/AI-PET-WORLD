/**
 * 当前文件负责：定义主世界草地类设计内容。
 */

import type { StageDesignCatalogGroup, StageDesignItem } from "../stage-design-types"

export const GRASS_STAGE_DESIGN_ITEMS: StageDesignItem[] = [
  {
    id: "terrain_short_grass",
    category: "terrain",
    label: "短草地",
    description:
      "核心庭院、宠物活动区和家园附近的基础地面，提供温暖、稳定、可停留的主视觉底色。",
    priority: "P0",
    mvpStatus: "enabled",
    density: "high",
    placements: ["core_courtyard", "pet_activity_area", "home_area", "path_side"],
    interactionRoles: ["visual_only", "atmosphere_feedback"],
    timeMode: "all_day",
    visualKeywords: ["低饱和绿色", "柔和", "安全", "庭院感", "不抢角色"],
    validationNotes: [
      "短草地必须服务核心庭院，不允许让主角和生命舱淹没在背景里。",
      "不能整片纯色铺满，需要保留轻微草叶和明暗变化。",
      "颜色亮度要保证宠物、管家、生命舱轮廓清楚。",
    ],
  },
  {
    id: "terrain_wild_grass",
    category: "terrain",
    label: "野草地",
    description:
      "森林边缘、地图边界和自然过渡区的地面，用来制造野外感和世界边界。",
    priority: "P0",
    mvpStatus: "enabled",
    density: "medium",
    placements: ["forest_edge", "map_edge", "background"],
    interactionRoles: ["visual_only", "pet_perception_source", "atmosphere_feedback"],
    timeMode: "all_day",
    visualKeywords: ["深绿色", "边界感", "自然", "稍微杂乱", "森林过渡"],
    validationNotes: [
      "野草地不能压进核心庭院中心。",
      "野草地不能遮挡宠物、管家、生命舱。",
      "野草地应主要服务地图边界和森林氛围。",
    ],
  },
  {
    id: "terrain_flower_grass",
    category: "terrain",
    label: "花草地",
    description:
      "花草坡地和庭院边缘的基础地面，为花丛、蝴蝶、花香粒子提供承载区域。",
    priority: "P0",
    mvpStatus: "enabled",
    density: "medium",
    placements: ["flower_slope", "core_courtyard", "path_side"],
    interactionRoles: ["visual_only", "pet_perception_source", "atmosphere_feedback"],
    timeMode: "daytime",
    visualKeywords: ["浅绿", "花点", "生命感", "轻快", "温柔"],
    validationNotes: [
      "花草地应该集中成区域，不能全图随机撒满。",
      "花草地不能比宠物更抢眼。",
      "花草地需要和蝴蝶、花香粒子保持统一区域关系。",
    ],
  },
]

export const GRASS_STAGE_DESIGN_GROUP: StageDesignCatalogGroup = {
  groupId: "terrain_grass",
  label: "草地类",
  description: "定义短草地、野草地、花草地等主世界基础地表内容。",
  items: GRASS_STAGE_DESIGN_ITEMS,
}