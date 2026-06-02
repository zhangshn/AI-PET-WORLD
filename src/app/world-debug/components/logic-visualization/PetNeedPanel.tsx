/**
 * 当前文件负责展示宠物需求摘要。
 */

import type { PetNeedSummary } from "@/world/visualization/world-visualization-schema"

import { LOGIC_VISUALIZATION_STYLES as styles } from "./logic-visualization-styles"

type PetNeedPanelProps = {
  pet: PetNeedSummary
}

export function PetNeedPanel({ pet }: PetNeedPanelProps) {
  return (
    <section style={styles.card}>
      <h2 style={styles.cardTitle}>Pet Need Panel</h2>
      <div style={styles.meterList}>
        <NeedMeter label="休息需求" value={pet.restNeed} />
        <NeedMeter label="食物需求" value={pet.foodNeed} />
        <NeedMeter label="饮水需求" value={pet.waterNeed} />
        <NeedMeter label="安全感需求" value={pet.safetyNeed} />
      </div>
      <p style={{ ...styles.bodyText, marginTop: "14px" }}>
        {pet.currentFocus}
      </p>
    </section>
  )
}

function NeedMeter({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={styles.meterLabelRow}>
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div style={styles.progressTrack}>
        <div
          style={{
            ...styles.progressFill,
            width: `${Math.max(0, Math.min(value, 100))}%`,
          }}
        />
      </div>
    </div>
  )
}
