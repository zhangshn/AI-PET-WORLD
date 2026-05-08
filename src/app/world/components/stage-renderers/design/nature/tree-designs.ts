/**
 * 当前文件负责：定义主世界树木类设计内容。
 */

import type { StageDesignCatalogGroup, StageDesignItem } from "../stage-design-types"

export const TREE_STAGE_DESIGN_ITEMS: StageDesignItem[] = [
  {
    id: "tree_large_boundary",
    category: "tree",
    label: "大型边界树",
    description:
      "放在地图北部、左侧和边缘区域，用于形成森林边界、世界深度和安全边界感。",
    priority: "P0",
    mvpStatus: "enabled",
    density: "medium",
    placements: ["forest_edge", "map_edge", "background"],
    interactionRoles: ["visual_only", "pet_perception_source", "atmosphere_feedback"],
    timeMode: "all_day",
    visualKeywords: ["大树冠", "深绿色", "森林边界", "阴影", "空间深度"],
    validationNotes: [
      "大型边界树不能遮挡生命舱、小屋、宠物和管家。",
      "大型边界树应该主要服务地图边界，不应进入核心庭院中心。",
      "树冠密度不能过高，避免画面压迫和主角不清晰。",
    ],
  },
  {
    id: "tree_small_courtyard",
    category: "tree",
    label: "庭院小树",
    description:
      "放在核心庭院边缘、路径旁或小屋附近，作为温和自然装饰和宠物观察对象。",
    priority: "P1",
    mvpStatus: "enabled",
    density: "low",
    placements: ["core_courtyard", "home_area", "path_side"],
    interactionRoles: ["visual_only", "pet_perception_source", "atmosphere_feedback"],
    timeMode: "all_day",
    visualKeywords: ["小树", "浅绿高光", "庭院感", "温和", "陪伴感"],
    validationNotes: [
      "庭院小树数量要少，不能抢生命舱和宠物的视觉中心。",
      "庭院小树不能遮挡路径和宠物活动区。",
      "庭院小树更适合作为环境观察点，不做强交互。",
    ],
  },
  {
    id: "tree_stump_detail",
    category: "tree",
    label: "树桩",
    description:
      "放在森林边缘、路径旁或地图角落，用于增加自然生活痕迹和地面细节。",
    priority: "P1",
    mvpStatus: "enabled",
    density: "very_low",
    placements: ["forest_edge", "path_side", "map_edge"],
    interactionRoles: ["visual_only", "future_expandable"],
    timeMode: "all_day",
    visualKeywords: ["木质", "自然痕迹", "小型细节", "低存在感"],
    validationNotes: [
      "树桩不能被误读为功能按钮。",
      "树桩不能放在宠物默认活动中心。",
      "树桩数量应非常少，只作为环境细节。",
    ],
  },
]

export const TREE_STAGE_DESIGN_GROUP: StageDesignCatalogGroup = {
  groupId: "nature_tree",
  label: "树木类",
  description: "定义大型边界树、庭院小树、树桩等主世界树木内容。",
  items: TREE_STAGE_DESIGN_ITEMS,
}