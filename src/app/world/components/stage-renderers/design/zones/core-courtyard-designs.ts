/**
 * 当前文件负责：定义主世界核心庭院作为 MVP 主舞台的设计内容。
 */

import type { StageDesignCatalogGroup, StageDesignItem } from "../stage-design-types"

export const CORE_COURTYARD_STAGE_DESIGN_ITEMS: StageDesignItem[] = [
  {
    id: "core_courtyard_main_stage",
    category: "actor_zone",
    label: "核心生活庭院主舞台",
    description:
      "MVP 主世界的核心可视舞台，承载生命舱、小屋、宠物、管家、自然环境、P-Phone 事件和基础世界反馈。它是玩家理解双主角生活的入口，不是限制宠物和管家行动的牢笼。",
    priority: "P0",
    mvpStatus: "enabled",
    density: "very_low",
    placements: ["core_courtyard", "home_area", "life_capsule_area"],
    interactionRoles: ["movement_guidance", "home_progress_anchor", "atmosphere_feedback"],
    timeMode: "all_day",
    visualKeywords: ["主舞台", "生活感", "生命舱", "小屋", "宠物", "管家", "观察感"],
    validationNotes: [
      "核心庭院必须让玩家第一眼看到宠物、管家、生命舱和家园关系。",
      "核心庭院不是宠物行动边界，宠物可基于自身 goal 进入短程探索。",
      "核心庭院不能像后台面板，也不能像经营农场。",
      "所有主世界表达都要服务固定世界 + 双主角自主发挥。",
    ],
  },
  {
    id: "core_courtyard_life_anchor",
    category: "structure",
    label: "核心生命锚点",
    description:
      "生命舱、小屋和庭院构成 MVP 的生命锚点。它们为宠物和管家的自主行为提供稳定背景，让玩家知道世界是固定舞台，主体才是变化核心。",
    priority: "P0",
    mvpStatus: "enabled",
    density: "very_low",
    placements: ["life_capsule_area", "home_area", "core_courtyard"],
    interactionRoles: ["home_progress_anchor", "butler_work_target", "atmosphere_feedback"],
    timeMode: "all_day",
    visualKeywords: ["生命锚点", "稳定", "家园", "生命舱", "固定舞台", "成长"],
    validationNotes: [
      "生命锚点要稳定，不跟随宠物人格随机改变地图结构。",
      "世界资源是固定素材，不要在 MVP 引入八字/风水生成地图。",
      "宠物和管家的差异来自人格、状态、记忆、关系和行为链。",
    ],
  },
  {
    id: "core_courtyard_world_edge_hint",
    category: "actor_zone",
    label: "世界边缘暗示场景",
    description:
      "核心庭院边缘通过森林、小路、湖边和小镇方向牌暗示世界还有外侧空间。MVP 使用它承载短程探索与边界观察，不开放完整大地图玩法。",
    priority: "P0",
    mvpStatus: "enabled",
    density: "very_low",
    placements: ["map_edge", "forest_edge", "path_side", "background"],
    interactionRoles: ["movement_guidance", "future_expandable", "world_notice_anchor"],
    timeMode: "all_day",
    visualKeywords: ["边缘", "小路", "森林", "小镇方向", "短程探索", "未来扩展"],
    validationNotes: [
      "世界边缘必须可见，但不能误导玩家以为 MVP 已开放大地图。",
      "边缘场景用于表达宠物短程探索和管家回应。",
      "世界边缘不是固定触发器，必须承接 AI goal/action 的结果。",
    ],
    futureHook:
      "未来可扩展小镇、公园、诊所、远行、共享区域；MVP 只做边界观察和短程探索表达。",
  },
]

export const CORE_COURTYARD_STAGE_DESIGN_GROUP: StageDesignCatalogGroup = {
  groupId: "core_courtyard",
  label: "核心庭院主舞台",
  description:
    "定义 MVP 主世界核心庭院、生命锚点和世界边缘暗示，确保世界固定、资源固定、双主角自主发挥。",
  items: CORE_COURTYARD_STAGE_DESIGN_ITEMS,
}
