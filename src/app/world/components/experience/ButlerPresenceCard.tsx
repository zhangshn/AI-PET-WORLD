/**
 * 当前文件负责展示管家当前判断。
 */

import type { WorldExperienceModel } from "@/world/visualization/world-experience-schema"

import { WORLD_EXPERIENCE_STYLES as styles } from "./world-experience-styles"

type ButlerPresenceCardProps = {
  butler: WorldExperienceModel["butler"]
}

export function ButlerPresenceCard({ butler }: ButlerPresenceCardProps) {
  return (
    <section style={styles.card}>
      <h2 style={styles.cardTitle}>管家正在判断</h2>
      <span style={styles.badge}>{butler.autonomyLabel}</span>
      <Info label="当前任务" value={butler.taskLabel} />
      <Info label="为什么这么做" value={butler.reason} />
      <Info label="下一步可能行动" value={butler.nextAction} />
    </section>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginTop: "14px" }}>
      <p style={styles.smallLabel}>{label}</p>
      <p style={styles.strong}>{value}</p>
    </div>
  )
}
