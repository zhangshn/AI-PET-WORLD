/**
 * 当前文件负责：定义主世界公告栏类设计内容。
 */

import type { StageDesignCatalogGroup, StageDesignItem } from "../stage-design-types"

export const BOARD_STAGE_DESIGN_ITEMS: StageDesignItem[] = [
  {
    id: "structure_world_notice_board",
    category: "structure",
    label: "公告栏",
    description:
      "主世界中的世界通知锚点，用来把世界事件、设施进度和未来小镇方向以视觉物件的形式展示给玩家。",
    priority: "P0",
    mvpStatus: "enabled",
    density: "very_low",
    placements: ["path_side", "home_area", "core_courtyard"],
    interactionRoles: ["world_notice_anchor", "visual_only"],
    timeMode: "all_day",
    visualKeywords: [
      "木质公告栏",
      "小纸条",
      "世界通知",
      "小镇方向",
      "低调提示",
    ],
    validationNotes: [
      "公告栏不能抢生命舱和宠物的视觉中心。",
      "公告栏不能变成复杂经营系统入口。",
      "公告栏应作为世界通知锚点，与 P-Phone 世界通知形成前后台呼应。",
      "公告栏位置由结构布局层决定，不在设计文件中生成。",
    ],
    futureHook:
      "后续设施开放、小镇事件、公园或诊所进度可通过公告栏视觉变化体现；MVP 只保留基础通知锚点。",
  },
]

export const BOARD_STAGE_DESIGN_GROUP: StageDesignCatalogGroup = {
  groupId: "structure_board",
  label: "公告栏类",
  description: "定义公告栏等世界通知锚点内容。",
  items: BOARD_STAGE_DESIGN_ITEMS,
}