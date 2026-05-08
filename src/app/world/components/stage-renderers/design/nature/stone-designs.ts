/**
 * 当前文件负责：定义主世界石头类设计内容。
 */

import type { StageDesignCatalogGroup, StageDesignItem } from "../stage-design-types"

export const STONE_STAGE_DESIGN_ITEMS: StageDesignItem[] = [
  {
    id: "stone_small_scatter",
    category: "stone",
    label: "小石头",
    description:
      "用于草地、路径边、湖边和森林边缘的低密度地面细节。",
    priority: "P1",
    mvpStatus: "enabled",
    density: "low",
    placements: ["path_side", "lake_side", "forest_edge", "map_edge"],
    interactionRoles: ["visual_only"],
    timeMode: "all_day",
    visualKeywords: ["灰色", "小块", "低对比", "地形细节", "自然"],
    validationNotes: [
      "小石头不能挡住宠物移动目标。",
      "小石头不能密集到像障碍物。",
      "小石头颜色要低调，不能抢角色轮廓。",
    ],
  },
  {
    id: "stone_lake_edge",
    category: "stone",
    label: "岸边石",
    description:
      "放在浅水湖边缘，用来塑造湖岸边界和自然过渡感。",
    priority: "P1",
    mvpStatus: "enabled",
    density: "low",
    placements: ["lake_side"],
    interactionRoles: ["visual_only", "pet_perception_source"],
    timeMode: "all_day",
    visualKeywords: ["湖边", "岸线", "灰蓝", "自然过渡", "低对比"],
    validationNotes: [
      "岸边石不能堵住宠物观察湖面的视觉通道。",
      "岸边石不能太多，否则湖岸会显得杂乱。",
      "岸边石应辅助湖区边界，而不是成为障碍。",
    ],
  },
  {
    id: "stone_path_edge",
    category: "stone",
    label: "路边石",
    description:
      "放在路径边缘，用来帮助玩家看清路径走向和区域边界。",
    priority: "P2",
    mvpStatus: "enabled",
    density: "very_low",
    placements: ["path_side"],
    interactionRoles: ["visual_only", "movement_guidance"],
    timeMode: "all_day",
    visualKeywords: ["路径边缘", "小块", "方向感", "低密度"],
    validationNotes: [
      "路边石不能让路径显得僵硬。",
      "路边石数量必须少，只做方向提示。",
    ],
  },
]

export const STONE_STAGE_DESIGN_GROUP: StageDesignCatalogGroup = {
  groupId: "nature_stone",
  label: "石头类",
  description: "定义小石头、岸边石、路边石等主世界石头内容。",
  items: STONE_STAGE_DESIGN_ITEMS,
}