/**
 * 当前文件负责：定义主世界花草类设计内容。
 */

import type { StageDesignCatalogGroup, StageDesignItem } from "../stage-design-types"

export const FLOWER_STAGE_DESIGN_ITEMS: StageDesignItem[] = [
  {
    id: "flower_patch_main",
    category: "plant",
    label: "花草丛",
    description:
      "花草坡地和庭院边缘的主要生命感来源，用于承载蝴蝶、花香粒子和宠物好奇观察。",
    priority: "P0",
    mvpStatus: "enabled",
    density: "medium",
    placements: ["flower_slope", "core_courtyard", "path_side"],
    interactionRoles: ["pet_perception_source", "atmosphere_feedback"],
    timeMode: "daytime",
    visualKeywords: ["粉色", "黄色", "浅紫", "花点", "生命感", "温柔"],
    validationNotes: [
      "花草丛应集中成区域，不要全图随机撒满。",
      "花草颜色不能比宠物和生命舱更抢眼。",
      "花草丛要和蝴蝶、花香粒子保持区域一致。",
    ],
  },
  {
    id: "flower_small_scatter",
    category: "plant",
    label: "零散小花",
    description:
      "用于点缀路径边、草地边缘和小屋附近，增加生活感和自然细节。",
    priority: "P1",
    mvpStatus: "enabled",
    density: "low",
    placements: ["path_side", "home_area", "core_courtyard"],
    interactionRoles: ["visual_only", "atmosphere_feedback"],
    timeMode: "daytime",
    visualKeywords: ["小花点", "低密度", "点缀", "柔和", "不抢眼"],
    validationNotes: [
      "零散小花不能让草地变成噪点。",
      "零散小花应低密度使用。",
      "花色应与主花草丛保持统一。",
    ],
  },
]

export const FLOWER_STAGE_DESIGN_GROUP: StageDesignCatalogGroup = {
  groupId: "nature_flower",
  label: "花草类",
  description: "定义花草丛、零散小花等主世界花草内容。",
  items: FLOWER_STAGE_DESIGN_ITEMS,
}