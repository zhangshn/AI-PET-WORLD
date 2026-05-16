/**
 * 当前文件负责展示地图变化事件日志。
 */

import type { MapDiffLogSummary } from "@/world/visualization/world-visualization-schema"

import { LOGIC_VISUALIZATION_STYLES as styles } from "./logic-visualization-styles"

type MapDiffEventLogProps = {
  mapDiffs: MapDiffLogSummary
}

export function MapDiffEventLog({ mapDiffs }: MapDiffEventLogProps) {
  return (
    <section style={styles.card}>
      <h2 style={styles.cardTitle}>Event / MapDiff Log</h2>
      <p style={styles.sectionHint}>
        所有可见变化都来自 MapDiff 或建设计划消息，而不是静态页面。
      </p>
      <div style={styles.logList}>
        {mapDiffs.items.length === 0 ? (
          <p style={styles.bodyText}>暂无新的地图变化。</p>
        ) : (
          mapDiffs.items.map((item) => (
            <article key={item.id} style={styles.logItem}>
              <p style={styles.strongText}>{item.label}</p>
              <p style={styles.bodyText}>{item.description}</p>
              <p style={{ ...styles.metricLabel, margin: "8px 0 0" }}>
                {item.tickLabel} · {getTypeLabel(item.type)}
              </p>
            </article>
          ))
        )}
      </div>
    </section>
  )
}

function getTypeLabel(type: MapDiffLogSummary["items"][number]["type"]) {
  const labels: Record<MapDiffLogSummary["items"][number]["type"], string> = {
    add: "新增",
    update: "更新",
    move: "移动",
    remove: "移除",
  }

  return labels[type]
}
