/**
 * 当前文件负责：定义管家自主回应在主世界中的表达场景。
 */

import type { StageDesignCatalogGroup, StageDesignItem } from "../stage-design-types"

export const BUTLER_RESPONSE_SCENE_STAGE_DESIGN_ITEMS: StageDesignItem[] = [
  {
    id: "butler_response_incubator_care_scene",
    category: "actor_zone",
    label: "管家生命舱照看回应场景",
    description:
      "当管家的人格、任务判断和世界状态让它关注生命舱时，主世界通过生命舱旁的停留、检查、记录和柔和维护动作表达它的管理职责。管家照看生命舱，但不决定宠物出生后的日常行为。",
    priority: "P0",
    mvpStatus: "enabled",
    density: "very_low",
    placements: ["life_capsule_area", "core_courtyard"],
    interactionRoles: ["butler_work_target", "home_progress_anchor", "atmosphere_feedback"],
    timeMode: "all_day",
    visualKeywords: ["照看", "生命舱", "记录", "维护", "稳定", "管理职责"],
    validationNotes: [
      "管家照看生命舱是职责表达，不是宠物控制。",
      "生命舱照看行为不能遮挡生命舱主体。",
      "宠物出生后，管家需要转向观察、解释、提供机会和环境管理。",
    ],
  },
  {
    id: "butler_response_home_building_scene",
    category: "actor_zone",
    label: "管家家园建设回应场景",
    description:
      "当管家判断家园需要建设或维护时，主世界通过小屋、工具箱、木板路和记录桌附近的动作表达家园成长。建设是管家的管理职责，不是经营玩法扩张。",
    priority: "P0",
    mvpStatus: "enabled",
    density: "very_low",
    placements: ["home_area", "path_side", "core_courtyard"],
    interactionRoles: ["butler_work_target", "home_progress_anchor", "visual_only"],
    timeMode: "all_day",
    visualKeywords: ["建设", "工具", "小屋", "木板路", "维护", "家园成长"],
    validationNotes: [
      "家园建设不能变成复杂经营系统。",
      "管家建设环境，不替宠物决定行为。",
      "建设变化应服务生活感和世界正在运行的感受。",
    ],
  },
  {
    id: "butler_response_observation_record_scene",
    category: "actor_zone",
    label: "管家观察记录回应场景",
    description:
      "当管家选择 watching_pet 或记录世界变化时，主世界通过保持距离、停顿、记录桌、P-Phone 短信和事件日志表达它正在观察和解释，而不是控制宠物。",
    priority: "P0",
    mvpStatus: "enabled",
    density: "very_low",
    placements: ["core_courtyard", "home_area", "path_side"],
    interactionRoles: ["butler_work_target", "world_notice_anchor", "atmosphere_feedback"],
    timeMode: "all_day",
    visualKeywords: ["观察", "记录", "解释", "保持距离", "P-Phone", "管家报告"],
    validationNotes: [
      "观察记录不能表现成管家在遥控宠物。",
      "管家短信应解释世界发生了什么，而不是发布命令。",
      "观察记录要与 AI Data / F3 审计形成前后台呼应。",
    ],
  },
  {
    id: "butler_response_opportunity_scene",
    category: "actor_zone",
    label: "管家机会提供回应场景",
    description:
      "当管家根据自身人格、关系和任务判断提供食物、休息或靠近机会时，主世界应表达为环境机会，而不是命令。宠物可以接受、忽略或拒绝。",
    priority: "P0",
    mvpStatus: "enabled",
    density: "very_low",
    placements: ["home_area", "path_side", "core_courtyard"],
    interactionRoles: ["butler_work_target", "movement_guidance", "atmosphere_feedback"],
    timeMode: "all_day",
    visualKeywords: ["机会", "食物", "休息", "靠近", "等待", "自主回应"],
    validationNotes: [
      "机会不是命令。",
      "宠物接受或拒绝机会都应被记录进事件、关系和记忆。",
      "玩家不能通过 P-Phone 直接强制宠物接受机会。",
    ],
  },
  {
    id: "butler_response_boundary_scene",
    category: "actor_zone",
    label: "管家边界回应场景",
    description:
      "当宠物进入短程探索或边界观察时，管家可以根据自身人格和关系选择观察、等待、靠近陪伴或保护性回应。这里不是固定等级触发，而是管家作为第二主角的自主回应表达。",
    priority: "P0",
    mvpStatus: "enabled",
    density: "very_low",
    placements: ["map_edge", "path_side", "forest_edge", "core_courtyard"],
    interactionRoles: ["butler_work_target", "movement_guidance", "world_notice_anchor"],
    timeMode: "all_day",
    visualKeywords: ["边界", "等待", "陪伴", "保护", "保持距离", "回应"],
    validationNotes: [
      "管家边界回应不是固定风险等级表。",
      "普通边界探索下，管家不应默认强制带回。",
      "保护性回应可以存在，但必须来自管家自身判断，并通过 P-Phone / F3 解释原因。",
      "管家是第二主角，不是系统按钮。",
    ],
  },
]

export const BUTLER_RESPONSE_SCENE_STAGE_DESIGN_GROUP: StageDesignCatalogGroup = {
  groupId: "butler_response_scene",
  label: "管家自主回应场景",
  description:
    "定义管家在固定世界中表达照看、建设、观察、机会提供和边界回应等自主管理行为的场景。",
  items: BUTLER_RESPONSE_SCENE_STAGE_DESIGN_ITEMS,
}
