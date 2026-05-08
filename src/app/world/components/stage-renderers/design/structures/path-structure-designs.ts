/**
 * 当前文件负责：定义主世界结构化路径类设计内容。
 */

import type { StageDesignCatalogGroup, StageDesignItem } from "../stage-design-types"

export const PATH_STRUCTURE_STAGE_DESIGN_ITEMS: StageDesignItem[] = [
  {
    id: "structure_wooden_path",
    category: "structure",
    label: "木板路",
    description:
      "连接生命舱、小屋、庭院、湖边和公告栏的结构化路径，用来让玩家快速理解主世界空间关系。",
    priority: "P0",
    mvpStatus: "enabled",
    density: "low",
    placements: ["core_courtyard", "home_area", "life_capsule_area", "path_side"],
    interactionRoles: ["movement_guidance", "home_progress_anchor", "visual_only"],
    timeMode: "all_day",
    visualKeywords: ["木板", "路径", "生活感", "连接", "温暖", "方向感"],
    validationNotes: [
      "木板路用于空间引导，不代表玩家直接控制宠物路径。",
      "木板路不能密集到像经营建设游戏。",
      "木板路不能切碎宠物活动区。",
      "木板路的实际地形和坐标由 world/map 或结构布局层决定，不在设计文件中生成。",
    ],
  },
  {
    id: "structure_town_direction_sign",
    category: "structure",
    label: "小镇方向牌",
    description:
      "放在路径边缘或小镇入口方向的低调提示物，用来暗示世界未来会扩展出小镇、诊所、公园等设施。",
    priority: "P1",
    mvpStatus: "enabled",
    density: "very_low",
    placements: ["path_side", "map_edge"],
    interactionRoles: ["world_notice_anchor", "future_expandable", "visual_only"],
    timeMode: "all_day",
    visualKeywords: ["路牌", "小镇方向", "木牌", "未来扩展", "低调"],
    validationNotes: [
      "小镇方向牌不能让玩家误以为 MVP 已经开放大地图探索。",
      "小镇方向牌只做世界边界和未来扩展暗示。",
      "小镇方向牌位置由 world/map 或结构布局层决定，不在设计文件中生成。",
    ],
    futureHook:
      "后续宠物医院、公园、小镇开放后，可把方向牌升级为实际区域入口；MVP 只做视觉暗示。",
  },
]

export const PATH_STRUCTURE_STAGE_DESIGN_GROUP: StageDesignCatalogGroup = {
  groupId: "structure_path",
  label: "结构路径类",
  description: "定义木板路、小镇方向牌等主世界结构化路径内容。",
  items: PATH_STRUCTURE_STAGE_DESIGN_ITEMS,
}