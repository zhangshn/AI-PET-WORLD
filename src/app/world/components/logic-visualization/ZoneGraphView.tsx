/**
 * 当前文件负责展示家园区域关系图。
 */

import type { ZoneGraphSummary } from "@/world/visualization/world-visualization-schema"

import { LOGIC_VISUALIZATION_STYLES as styles } from "./logic-visualization-styles"

type ZoneGraphViewProps = {
  zones: ZoneGraphSummary
}

export function ZoneGraphView({ zones }: ZoneGraphViewProps) {
  return (
    <section style={styles.card}>
      <h2 style={styles.cardTitle}>Zone Graph View</h2>
      <p style={styles.sectionHint}>
        这里展示区域关系，而不是像素地图坐标。区域状态来自 HomeMapState。
      </p>
      <div style={styles.nodeGrid}>
        {zones.nodes.map((node) => (
          <article
            key={node.id}
            style={{
              ...styles.node,
              borderColor: getNodeBorderColor(node.status),
            }}
          >
            <span
              style={{
                ...styles.badge,
                background: getNodeBadgeColor(node.status),
              }}
            >
              {getNodeStatusText(node.status)}
            </span>
            <p style={{ ...styles.strongText, marginTop: "10px" }}>
              {node.label}
            </p>
            <p style={styles.bodyText}>{node.role}</p>
          </article>
        ))}
      </div>
      <div style={styles.edgeList}>
        {zones.edges.map((edge) => (
          <div key={`${edge.from}-${edge.to}`} style={styles.edge}>
            {edge.from} → {edge.to}｜{edge.label}
          </div>
        ))}
      </div>
    </section>
  )
}

function getNodeStatusText(
  status: ZoneGraphSummary["nodes"][number]["status"]
): string {
  const labels: Record<ZoneGraphSummary["nodes"][number]["status"], string> = {
    quiet: "安静",
    active: "活跃",
    under_construction: "建设中",
    completed: "完成",
  }

  return labels[status]
}

function getNodeBadgeColor(
  status: ZoneGraphSummary["nodes"][number]["status"]
): string {
  if (status === "under_construction") return "#f6e05e"
  if (status === "completed") return "#9ae6b4"
  if (status === "active") return "#90cdf4"
  return "#cbd5e0"
}

function getNodeBorderColor(
  status: ZoneGraphSummary["nodes"][number]["status"]
): string {
  if (status === "under_construction") return "rgba(246, 224, 94, 0.5)"
  if (status === "completed") return "rgba(154, 230, 180, 0.44)"
  if (status === "active") return "rgba(144, 205, 244, 0.42)"
  return "rgba(130, 158, 194, 0.18)"
}
