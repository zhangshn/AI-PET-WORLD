/**
 * 当前文件负责：定义主世界家园与小屋类设计内容。
 */

import type { StageDesignCatalogGroup, StageDesignItem } from "../stage-design-types"

export const HOME_STAGE_DESIGN_ITEMS: StageDesignItem[] = [
  {
    id: "structure_home_shelter",
    category: "structure",
    label: "小屋 / 家园核心",
    description:
      "主世界中的基础生活空间，用来承载家园成长、管家建设行为和宠物安全感。MVP 阶段只表现基础小屋和生活感，不做复杂经营。",
    priority: "P0",
    mvpStatus: "enabled",
    density: "very_low",
    placements: ["home_area", "core_courtyard"],
    interactionRoles: [
      "home_progress_anchor",
      "butler_work_target",
      "atmosphere_feedback",
    ],
    timeMode: "all_day",
    visualKeywords: [
      "木质小屋",
      "暖光窗户",
      "屋檐",
      "生活空间",
      "安全感",
      "家园成长",
    ],
    validationNotes: [
      "小屋必须像生活空间，不要像后台模块入口。",
      "小屋不能遮挡生命舱和宠物活动区。",
      "小屋建设变化应服务家园成长感，但 MVP 不扩展成经营玩法。",
      "小屋位置由 world/map 或结构布局层决定，不在设计文件中生成。",
    ],
    futureHook:
      "后续可根据家园等级、季节、天气和管家建设进度改变外观；MVP 先固定基础形态。",
  },
  {
    id: "structure_home_toolbox",
    category: "structure",
    label: "工具箱",
    description:
      "管家建设家园时的辅助视觉物件，用来强化管家正在照看和建设世界的感觉。",
    priority: "P1",
    mvpStatus: "enabled",
    density: "very_low",
    placements: ["home_area", "butler_observation_area", "path_side"],
    interactionRoles: ["butler_work_target", "home_progress_anchor", "visual_only"],
    timeMode: "all_day",
    visualKeywords: ["工具箱", "木箱", "建设感", "低存在感", "管家工作"],
    validationNotes: [
      "工具箱不能被误读为可点击背包或商店。",
      "工具箱只作为管家工作感补充，不成为主玩法入口。",
      "工具箱数量和具体位置由实体或结构布局层决定，不在设计文件中生成。",
    ],
  },
  {
    id: "structure_butler_record_table",
    category: "structure",
    label: "管家记录桌",
    description:
      "管家观察和记录世界变化时的辅助物件，用来把后台记录、解释和观察行为转成可见的前台物件。",
    priority: "P1",
    mvpStatus: "enabled",
    density: "very_low",
    placements: ["butler_observation_area", "home_area"],
    interactionRoles: ["butler_work_target", "visual_only"],
    timeMode: "all_day",
    visualKeywords: ["小木桌", "记录板", "纸张", "观察感", "管家职责"],
    validationNotes: [
      "记录桌不能看起来像复杂 UI 面板。",
      "记录桌只表达管家观察职责，不代表管家控制宠物。",
      "记录桌位置由结构布局层决定，不在设计文件中生成。",
    ],
  },
]

export const HOME_STAGE_DESIGN_GROUP: StageDesignCatalogGroup = {
  groupId: "structure_home",
  label: "家园类",
  description: "定义小屋、工具箱、管家记录桌等主世界家园内容。",
  items: HOME_STAGE_DESIGN_ITEMS,
}