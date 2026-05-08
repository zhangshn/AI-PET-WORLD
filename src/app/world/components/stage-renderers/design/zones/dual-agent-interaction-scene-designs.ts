/**
 * 当前文件负责：定义宠物与管家的双主角互动表达场景。
 */

import type { StageDesignCatalogGroup, StageDesignItem } from "../stage-design-types"

export const DUAL_AGENT_INTERACTION_SCENE_STAGE_DESIGN_ITEMS: StageDesignItem[] = [
  {
    id: "dual_agent_boundary_observation_scene",
    category: "actor_zone",
    label: "双主角边界观察互动场景",
    description:
      "当宠物因为 observe_boundary 停在庭院边缘、森林边缘或路径外侧时，管家可以保持距离观察并记录。这个场景表达宠物自主观察与管家自主回应同时发生。",
    priority: "P0",
    mvpStatus: "enabled",
    density: "very_low",
    placements: ["map_edge", "forest_edge", "path_side"],
    interactionRoles: ["movement_guidance", "world_notice_anchor", "pet_perception_source"],
    timeMode: "all_day",
    visualKeywords: ["边界观察", "保持距离", "记录", "自主", "双主角", "安静"],
    validationNotes: [
      "宠物到边界必须来自 pet goal/action/expression 链路。",
      "管家回应必须来自 butler profile/relation/task trace，不是固定等级。",
      "P-Phone 应把这类事件解释为观察，不要写成迷路或惩罚。",
    ],
  },
  {
    id: "dual_agent_short_excursion_scene",
    category: "actor_zone",
    label: "双主角短程探索互动场景",
    description:
      "当宠物因为 expand_territory 产生短程探索时，主世界应允许宠物向庭院外侧或小路尽头移动，管家根据自身人格选择观察、等待或靠近陪伴。MVP 必须可见这类核心亮点。",
    priority: "P0",
    mvpStatus: "enabled",
    density: "very_low",
    placements: ["map_edge", "path_side", "forest_edge", "background"],
    interactionRoles: ["movement_guidance", "world_notice_anchor", "future_expandable"],
    timeMode: "all_day",
    visualKeywords: ["短程探索", "外扩", "边缘", "等待", "陪伴", "关系"],
    validationNotes: [
      "短程探索属于 MVP，不推迟到未来。",
      "短程探索不是大地图远行，不做真正失踪。",
      "事件必须进入 AI Data 和 P-Phone，让玩家感受到后台 AI 链路。",
    ],
  },
  {
    id: "dual_agent_opportunity_acceptance_scene",
    category: "actor_zone",
    label: "双主角机会接受互动场景",
    description:
      "当管家提供食物、休息、靠近或未来的回家机会时，宠物可以接受。接受结果应表现为宠物自主回应，而不是管家命令成功。",
    priority: "P0",
    mvpStatus: "enabled",
    density: "very_low",
    placements: ["home_area", "core_courtyard", "path_side"],
    interactionRoles: ["butler_work_target", "movement_guidance", "atmosphere_feedback"],
    timeMode: "all_day",
    visualKeywords: ["机会", "接受", "自主回应", "关系变化", "记忆", "管家记录"],
    validationNotes: [
      "机会接受必须进入管家记忆和关系反馈。",
      "文案需要明确宠物是自主接受，不是被强制。",
      "玩家不能直接替宠物接受机会。",
    ],
  },
  {
    id: "dual_agent_opportunity_refusal_scene",
    category: "actor_zone",
    label: "双主角机会拒绝互动场景",
    description:
      "当管家提供机会但宠物没有接受时，主世界应把这理解为关系和状态的一部分，而不是错误。管家可以记录、等待或调整后续回应。",
    priority: "P0",
    mvpStatus: "enabled",
    density: "very_low",
    placements: ["core_courtyard", "path_side", "forest_edge"],
    interactionRoles: ["world_notice_anchor", "butler_work_target", "atmosphere_feedback"],
    timeMode: "all_day",
    visualKeywords: ["拒绝", "忽略", "保留距离", "关系边界", "记录", "等待"],
    validationNotes: [
      "宠物拒绝机会不是 bug，也不是失败惩罚。",
      "管家需要根据自身人格和关系状态决定下一步，不用固定等级表。",
      "拒绝结果应进入 AI Data 审计。",
    ],
  },
  {
    id: "dual_agent_protective_response_scene",
    category: "actor_zone",
    label: "双主角保护性回应场景",
    description:
      "当宠物处于明显不稳定、低能量或边界停留过久等情况时，管家可以基于自身判断做保护性回应。保护不是日常控制，而是管家管理权的一部分。",
    priority: "P1",
    mvpStatus: "enabled",
    density: "very_low",
    placements: ["map_edge", "path_side", "home_area"],
    interactionRoles: ["butler_work_target", "movement_guidance", "world_notice_anchor"],
    timeMode: "weather_sensitive",
    visualKeywords: ["保护", "照看", "边界", "带回", "解释", "安全"],
    validationNotes: [
      "保护性回应不能成为普通情况下的默认动作。",
      "保护性回应必须由管家人格、关系、任务判断和宠物状态共同驱动。",
      "保护性回应必须通过 P-Phone / F3 解释原因。",
    ],
  },
]

export const DUAL_AGENT_INTERACTION_SCENE_STAGE_DESIGN_GROUP: StageDesignCatalogGroup = {
  groupId: "dual_agent_interaction_scene",
  label: "双主角互动表达场景",
  description:
    "定义宠物自主意图与管家自主回应相遇时，在主世界、P-Phone 和 AI Data 中需要表达的互动场景。",
  items: DUAL_AGENT_INTERACTION_SCENE_STAGE_DESIGN_ITEMS,
}
