/**
 * 当前文件负责把地图变化记录转换为事件日志。
 */

import type {
  HomeMapState,
  MapDiff,
  MapDiffOperation,
} from "@/world/map-state/home-map-state-schema"

import type { MapDiffLogSummary } from "./world-visualization-schema"

const OPERATION_LABELS: Record<MapDiffOperation, string> = {
  add: "新增",
  update: "更新",
  move: "移动",
  remove: "移除",
}

export function buildMapDiffLogSummary(
  homeMapState: HomeMapState,
  constructionMessage: string
): MapDiffLogSummary {
  const items = [...homeMapState.mapDiffs]
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, 8)
    .map(mapDiffToLogItem)

  if (items.length > 0) {
    return { items }
  }

  if (constructionMessage.trim().length > 0) {
    return {
      items: [
        {
          id: "construction-message",
          type: "update",
          label: "建设状态更新",
          description: constructionMessage,
          tickLabel: "当前",
        },
      ],
    }
  }

  return { items: [] }
}

function mapDiffToLogItem(diff: MapDiff): MapDiffLogSummary["items"][number] {
  const targetLabel =
    diff.placement?.label ??
    diff.patch?.label ??
    diff.placementId.replace(/-/g, " ")

  return {
    id: diff.id,
    type: diff.operation,
    label: `${OPERATION_LABELS[diff.operation]}：${targetLabel}`,
    description: diff.reason,
    tickLabel: `记录 ${diff.createdAt}`,
  }
}
