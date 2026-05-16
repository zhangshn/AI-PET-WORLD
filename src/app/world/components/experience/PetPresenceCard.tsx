/**
 * 当前文件负责展示宠物当前需求。
 */

import type { WorldExperienceModel } from "@/world/visualization/world-experience-schema"

import { WORLD_EXPERIENCE_STYLES as styles } from "./world-experience-styles"

type PetPresenceCardProps = {
  pet: WorldExperienceModel["pet"]
}

export function PetPresenceCard({ pet }: PetPresenceCardProps) {
  return (
    <section style={styles.card}>
      <h2 style={styles.cardTitle}>宠物状态</h2>
      <p style={styles.strong}>{pet.stateLabel}</p>
      <div style={styles.meterList}>
        <NeedMeter label="休息" value={pet.restNeed} />
        <NeedMeter label="食物" value={pet.foodNeed} />
        <NeedMeter label="饮水" value={pet.waterNeed} />
        <NeedMeter label="安全感" value={pet.safetyNeed} />
      </div>
      <p style={{ ...styles.body, marginTop: "14px" }}>{pet.currentFocus}</p>
    </section>
  )
}

function NeedMeter({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={styles.meterRow}>
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div style={styles.track}>
        <div
          style={{
            ...styles.fill,
            width: `${Math.max(0, Math.min(value, 100))}%`,
          }}
        />
      </div>
    </div>
  )
}
