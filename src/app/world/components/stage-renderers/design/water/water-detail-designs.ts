/**
 * 当前文件负责：定义主世界水域细节类设计内容。
 */

import type { StageDesignCatalogGroup, StageDesignItem } from "../stage-design-types"

export const WATER_DETAIL_STAGE_DESIGN_ITEMS: StageDesignItem[] = [
  {
    id: "water_lake_reed",
    category: "plant",
    label: "湖边水草",
    description:
      "浅水湖边缘的低密度植物细节，用来表现湿润生态、水边层次和宠物观察来源。",
    priority: "P1",
    mvpStatus: "enabled",
    density: "low",
    placements: ["lake_side"],
    interactionRoles: ["visual_only", "pet_perception_source", "atmosphere_feedback"],
    timeMode: "all_day",
    visualKeywords: ["水草", "湖边", "湿润", "轻微摆动", "低对比"],
    validationNotes: [
      "湖边水草不能铺满湖岸。",
      "湖边水草不能遮挡水面波纹。",
      "湖边水草具体数量和位置由实体或渲染层决定，不在设计文件中决定。",
    ],
  },
  {
    id: "water_reflection_detail",
    category: "water",
    label: "水面倒影",
    description:
      "湖面上的细小高光和倒影线，用来表现时间、光照和安静的水面氛围。",
    priority: "P1",
    mvpStatus: "enabled",
    density: "low",
    placements: ["lake_side"],
    interactionRoles: ["visual_only", "atmosphere_feedback"],
    timeMode: "weather_sensitive",
    visualKeywords: ["高光", "倒影", "浅色横线", "低亮度", "时间感"],
    validationNotes: [
      "水面倒影不能过亮。",
      "水面倒影不能让湖面显得杂乱。",
      "倒影强度未来可由时间、天气、季节影响，但设计文件不执行逻辑。",
    ],
    futureHook:
      "后续季节和天气系统接入后，晴天增强倒影，阴雨天降低倒影；MVP 暂不执行。",
  },
  {
    id: "water_edge_moisture",
    category: "water",
    label: "湖岸湿润边缘",
    description:
      "湖水与草地之间的过渡细节，避免水域边界过硬，让地图更自然。",
    priority: "P1",
    mvpStatus: "enabled",
    density: "low",
    placements: ["lake_side", "path_side"],
    interactionRoles: ["visual_only", "atmosphere_feedback"],
    timeMode: "all_day",
    visualKeywords: ["湿润边缘", "泥土过渡", "自然", "低对比"],
    validationNotes: [
      "湖岸湿润边缘不能扩大成新的泥地玩法。",
      "湖岸湿润边缘只用于视觉过渡。",
      "具体地形类型由 world/map 层决定。",
    ],
  },
]

export const WATER_DETAIL_STAGE_DESIGN_GROUP: StageDesignCatalogGroup = {
  groupId: "water_detail",
  label: "水域细节类",
  description: "定义湖边水草、水面倒影、湖岸湿润边缘等水域细节内容。",
  items: WATER_DETAIL_STAGE_DESIGN_ITEMS,
}