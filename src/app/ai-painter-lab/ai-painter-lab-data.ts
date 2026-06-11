export function buildAiPainterLabStages(accepted: number) {
  return [
    { name: "Blueprint v0", status: "完成", detail: "固定 256×192，描述地形、道路与世界对象。" },
    { name: "Condition Mask", status: "完成", detail: "8 个结构通道，可直接供后续模型训练使用。" },
    { name: "数据导入与审计", status: "完成", detail: "许可、人工复核、SHA-256、重复 ID 与文件完整性。" },
    { name: "工程验证集", status: accepted >= 20 ? "完成" : "等待数据", detail: `当前 ${accepted}/20，图片由项目外人工制作后导入。` },
    { name: "最低训练集", status: accepted >= 100 ? "完成" : "未完成", detail: `当前 ${accepted}/100，达到后才能进入模型训练。` },
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

export const BLUEPRINT_JSON = `{
  "sceneId": "sample-forest-shore-001",
  "size": "256x192",
  "styleId": "bright-healing-topdown-pixel-v0",
  "terrain": ["grass", "water"],
  "roads": 1,
  "objects": ["shelter", "tree", "rock"],
  "conditionChannels": 8,
  "sourceReview": "required"
}`

export type ConditionChannelId = (typeof CONDITION_CHANNELS)[number]["id"]
