import type {
  FullZiweiChart,
  ZiweiInterpretationItem,
  ZiweiStarCategory
} from "../contracts"
import { BRANCH_LABELS, SECTOR_LABELS } from "../page-view/labels"

export function buildChartHighlights(
  chart: FullZiweiChart
): ZiweiInterpretationItem[] {
  const lifePalace = chart.palaces.find((palace) => palace.isLifePalace)
  const bodyPalace = chart.palaces.find((palace) => palace.isBodyPalace)
  const categoryTags = Object.entries(chart.summary.starCountsByCategory)
    .filter(([, count]) => count > 0)
    .map(([category, count]) => {
      return `${category}:${count}`
    })

  const highlights: ZiweiInterpretationItem[] = [
    {
      itemId: "chart-life-palace",
      scope: "chart",
      title: "命宫定位",
      summary: lifePalace
        ? `命宫落 ${BRANCH_LABELS[lifePalace.branch]}，对应 ${SECTOR_LABELS[lifePalace.sectorName]}，作为本盘基础观察入口。`
        : "命宫未能定位，需要回查基础盘生成流程。",
      tags: ["命宫", "基础盘", "入口"],
      sourceRuleIds: []
    },
    {
      itemId: "chart-body-palace",
      scope: "chart",
      title: "身宫定位",
      summary: bodyPalace
        ? `身宫落 ${BRANCH_LABELS[bodyPalace.branch]}，对应 ${SECTOR_LABELS[bodyPalace.sectorName]}，用于补充行动面向。`
        : "身宫未能定位，需要回查基础盘生成流程。",
      tags: ["身宫", "行动", "补充"],
      sourceRuleIds: []
    },
    {
      itemId: "chart-star-counts",
      scope: "chart",
      title: "星曜覆盖",
      summary: `本盘当前排出 ${chart.summary.totalStarCount} 颗星曜，已覆盖 ${categoryTags.length} 个启用类别。`,
      tags: [
        "星曜",
        ...categoryTags.map((tag) => tag as `${Exclude<ZiweiStarCategory, "empty">}:${number}`)
      ],
      sourceRuleIds: []
    }
  ]

  return highlights
}
