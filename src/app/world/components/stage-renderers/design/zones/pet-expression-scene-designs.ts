/**
 * 当前文件负责：定义宠物自主意图在主世界中的表达场景。
 */

import type { StageDesignCatalogGroup, StageDesignItem } from "../stage-design-types"

export const PET_EXPRESSION_SCENE_STAGE_DESIGN_ITEMS: StageDesignItem[] = [
  {
    id: "pet_expression_safe_attachment_scene",
    category: "actor_zone",
    label: "宠物安全依恋表达场景",
    description:
      "当宠物的人格、生命阶段、状态或记忆让它倾向于靠近熟悉区域时，主世界可以通过生命舱、小屋、暖光、熟悉气味和低活动路线表达这种安全依恋。这里不是固定限制区，而是宠物自主意图的表达场所。",
    priority: "P0",
    mvpStatus: "enabled",
    density: "very_low",
    placements: ["core_courtyard", "home_area", "life_capsule_area"],
    interactionRoles: ["movement_guidance", "pet_perception_source", "atmosphere_feedback"],
    timeMode: "all_day",
    visualKeywords: ["安全", "依恋", "熟悉", "暖光", "低活动", "生命舱附近"],
    validationNotes: [
      "这个场景不能被理解为宠物被固定在家附近。",
      "宠物是否靠近这里，必须由人格、状态、记忆、目标和行为链决定。",
      "玩家只能观察宠物选择，不能直接命令宠物停留。",
    ],
  },
  {
    id: "pet_expression_curious_observation_scene",
    category: "actor_zone",
    label: "宠物好奇观察表达场景",
    description:
      "当宠物因为好奇、警觉、认知刺激或世界事件产生观察意图时，主世界可以通过湖边、花草、蝴蝶、树影和水声表达它的注意力。场景提供表达，不提供命令。",
    priority: "P0",
    mvpStatus: "enabled",
    density: "low",
    placements: ["lake_side", "flower_slope", "forest_edge", "core_courtyard"],
    interactionRoles: ["pet_perception_source", "movement_guidance", "atmosphere_feedback"],
    timeMode: "all_day",
    visualKeywords: ["好奇", "停顿", "观察", "花香", "水声", "树影"],
    validationNotes: [
      "观察点必须来自世界刺激和宠物认知，不是固定巡逻点。",
      "宠物不能说人话，只通过动作、停顿、方向和事件文本表达。",
      "同一个观察场景下，不同人格宠物应表现出不同停留和靠近倾向。",
    ],
  },
  {
    id: "pet_expression_boundary_exploration_scene",
    category: "actor_zone",
    label: "宠物边界探索表达场景",
    description:
      "当宠物的当前目标进入 expand_territory 或 observe_boundary 时，主世界允许它走向庭院外侧、森林边缘、小路尽头或小镇方向牌附近。MVP 要表现短程探索，但不做真正失踪或大地图远行。",
    priority: "P0",
    mvpStatus: "enabled",
    density: "very_low",
    placements: ["map_edge", "forest_edge", "path_side", "background"],
    interactionRoles: ["movement_guidance", "pet_perception_source", "future_expandable"],
    timeMode: "all_day",
    visualKeywords: ["边界", "短程探索", "庭院外侧", "小路尽头", "森林边缘", "自主"],
    validationNotes: [
      "边界探索是 MVP 核心亮点，不能被降级成未来功能。",
      "短程探索必须由宠物 goal/action/expression 链路触发，不允许由 UI 固定触发。",
      "MVP 不做真正失踪、不做玩家召回按钮、不做危险生存玩法。",
      "管家可以观察、等待、陪伴或保护性回应，但回应也必须来自管家自身判断。",
    ],
    futureHook:
      "未来可扩展为远行、失踪、外部地图和更多关系后果；MVP 只做可见短程探索与边界观察。",
  },
  {
    id: "pet_expression_recovery_scene",
    category: "actor_zone",
    label: "宠物恢复休息表达场景",
    description:
      "当宠物进入低能量、恢复、睡眠或稳定自身状态时，主世界通过安静角落、休息垫、小屋附近、暖光和较慢动作表达恢复倾向。",
    priority: "P0",
    mvpStatus: "enabled",
    density: "very_low",
    placements: ["home_area", "core_courtyard", "background"],
    interactionRoles: ["movement_guidance", "atmosphere_feedback"],
    timeMode: "all_day",
    visualKeywords: ["恢复", "休息", "低能量", "安静", "暖光", "睡眠"],
    validationNotes: [
      "恢复场景不能强制覆盖宠物的所有行动，只能表达当前行为链结果。",
      "管家可以提供休息机会，但宠物是否接受仍由宠物自主判断。",
    ],
  },
]

export const PET_EXPRESSION_SCENE_STAGE_DESIGN_GROUP: StageDesignCatalogGroup = {
  groupId: "pet_expression_scene",
  label: "宠物意图表达场景",
  description:
    "定义宠物在固定世界中表达安全、好奇、边界探索和恢复等自主意图的场景。",
  items: PET_EXPRESSION_SCENE_STAGE_DESIGN_ITEMS,
}
