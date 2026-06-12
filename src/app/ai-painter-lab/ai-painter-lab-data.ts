export function buildAiPainterLabStages(accepted: number) {
  return [
    { name: "Blueprint v0", status: "完成", detail: "固定 256×192，描述地形、道路与世界对象。" },
    { name: "Condition Mask v0", status: "完成", detail: "8 个结构通道已接入数据集和模型输入。" },
    { name: "Condition Blueprint v1", status: "进行中", detail: "14 通道细粒度结构草案与人工复核入口正在接入。" },
    { name: "数据导入与审计", status: "完成", detail: "许可、人工复核、SHA-256、重复 ID 与文件完整性已实现。" },
    { name: "Tiny U-Net 训练链", status: "完成", detail: "RTX 5050 GPU 训练、日志、latest/best checkpoint 已验证。" },
    { name: "本地模型推理", status: "完成", detail: "已从 best.pt 生成第一张 256×192 PNG，仅供训练诊断。" },
    { name: "工程质量数据集", status: accepted >= 20 ? "完成" : "等待数据", detail: `当前 ${accepted}/20；达到后开始画质与结构控制迭代。` },
    { name: "视觉审核通过画面", status: "未完成", detail: "当前生成图不合格，不得进入 ApprovedFrame 或玩家画面。" },
  ]
}

export const CONDITION_CHANNELS = [
  { id: "grass", zh: "草地区域", color: "#b7dc72" },
  { id: "water", zh: "水域区域", color: "#73bed3" },
  { id: "road", zh: "道路结构", color: "#e6bd72" },
  { id: "tree", zh: "树木占位", color: "#4d8f57" },
  { id: "rock", zh: "石块占位", color: "#a6adb1" },
  { id: "shelter", zh: "住所占位", color: "#d18c52" },
  { id: "walkable", zh: "可行走区域", color: "#ede6bb" },
  { id: "depth", zh: "空间深度", color: "#b28acc" },
] as const

export const CONDITION_CHANNELS_V1 = [
  { id: "grass", zh: "草地区域", color: "#b7dc72" },
  { id: "water_body", zh: "水体内部", color: "#73bed3" },
  { id: "shoreline", zh: "水岸过渡", color: "#7abf8e" },
  { id: "road_center", zh: "道路中心", color: "#e6bd72" },
  { id: "road_edge", zh: "道路边缘", color: "#c9945d" },
  { id: "tree_trunk", zh: "树干落点", color: "#8f5a3c" },
  { id: "tree_crown", zh: "树冠覆盖", color: "#4d8f57" },
  { id: "rock", zh: "岩石区域", color: "#a6adb1" },
  { id: "shelter_foundation", zh: "建筑地基", color: "#9d7254" },
  { id: "shelter_wall", zh: "墙体立面", color: "#d18c52" },
  { id: "shelter_roof", zh: "屋顶结构", color: "#c8644a" },
  { id: "construction_material", zh: "施工材料", color: "#d8b56b" },
  { id: "walkable", zh: "可行走区域", color: "#ede6bb" },
  { id: "depth", zh: "空间深度", color: "#b28acc" },
] as const

export const BLUEPRINT_JSON = `{
  "sceneId": "sample-forest-shore-001",
  "size": "256x192",
  "styleId": "bright-healing-topdown-pixel-v0",
  "blueprintVersion": "world-blueprint-v1",
  "conditionChannels": 14,
  "manualReview": "required"
}`

export type ConditionChannelId = (typeof CONDITION_CHANNELS)[number]["id"] | (typeof CONDITION_CHANNELS_V1)[number]["id"]
