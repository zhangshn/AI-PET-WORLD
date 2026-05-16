/**
 * 当前文件负责展示世界运行状态摘要。
 */

import type { WorldStateSummary } from "@/world/visualization/world-visualization-schema"

import { LOGIC_VISUALIZATION_STYLES as styles } from "./logic-visualization-styles"

type WorldStateDashboardProps = {
  world: WorldStateSummary
}

export function WorldStateDashboard({ world }: WorldStateDashboardProps) {
  return (
    <section style={styles.card}>
      <h2 style={styles.cardTitle}>World State Dashboard</h2>
      <p style={styles.sectionHint}>
        世界仍在运行，当前界面展示的是真实世界状态的逻辑投影。
      </p>
      <div style={styles.metricGrid}>
        <Metric label="World Tick" value={String(world.tick)} />
        <Metric label="世界时间" value={`${world.dayLabel} ${world.timeLabel}`} />
        <Metric label="家园阶段" value={world.homeStatus} />
        <Metric
          label="本地保存"
          value={world.persistenceStatus === "local_saved" ? "已恢复" : "读取中"}
        />
        <Metric
          label="最近自动推进"
          value={
            world.lastAutoConstructionTick === null
              ? "尚未推进"
              : `Tick ${world.lastAutoConstructionTick}`
          }
        />
        <Metric label="世界数据量" value={`${world.placementCount} placements`} />
        <Metric label="区域数量" value={`${world.zoneCount} zones`} />
        <Metric label="Owner" value={world.ownerId} />
      </div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.metric}>
      <p style={styles.metricLabel}>{label}</p>
      <p style={styles.metricValue}>{value}</p>
    </div>
  )
}
