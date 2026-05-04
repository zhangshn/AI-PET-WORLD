/**
 * 当前文件负责：展示正式 world 页的舞台内轻量 HUD。
 */

import type { HudMeter, WorldHudBundle } from "../utils/worldHudMappers"

import styles from "@/styles/world-styles/world-compact-hud.module.css"

type Props = {
  hud: WorldHudBundle
}

function getMeterToneClass(tone: HudMeter["tone"]): string {
  if (tone === "good") return styles.good
  if (tone === "warning") return styles.warning
  if (tone === "danger") return styles.danger
  if (tone === "quiet") return styles.quiet
  if (tone === "active") return styles.active

  return styles.neutral
}

function MiniMeter({ meter }: { meter: HudMeter }) {
  return (
    <div className={styles.miniMeter}>
      <div className={styles.miniMeterTop}>
        <span>{meter.label}</span>
        <strong>{meter.valueLabel}</strong>
      </div>

      <div className={styles.meterTrack}>
        <div
          className={`${styles.meterFill} ${getMeterToneClass(meter.tone)}`}
          style={{ width: `${meter.value}%` }}
        />
      </div>
    </div>
  )
}

export default function WorldCompactHud({ hud }: Props) {
  return (
    <div className={styles.overlay}>
      <section className={styles.hud}>
        <div className={styles.primaryBlock}>
          <div className={styles.identityRow}>
            <span className={styles.eyebrow}>PET</span>
            <strong>{hud.pet.name}</strong>
            <span className={styles.tag}>{hud.pet.actionLabel}</span>
            <span className={styles.tag}>{hud.pet.moodLabel}</span>
          </div>

          <div className={styles.petMeters}>
            <MiniMeter meter={hud.pet.meters.energy} />
            <MiniMeter meter={hud.pet.meters.hunger} />
          </div>
        </div>

        <div className={styles.statusBlock}>
          <span className={styles.eyebrow}>BUTLER</span>
          <strong>{hud.butler.taskLabel}</strong>
          <span className={styles.subText}>{hud.butler.moodLabel}</span>
        </div>

        <div className={styles.statusBlock}>
          <span className={styles.eyebrow}>HOME</span>
          <strong>{hud.home.levelLabel}</strong>
          <span className={styles.subText}>{hud.home.statusLabel}</span>
        </div>

        <div className={styles.statusBlock}>
          <span className={styles.eyebrow}>WORLD</span>
          <strong>{hud.world.dayLabel}</strong>
          <span className={styles.subText}>
            {hud.world.timeLabel} · {hud.world.periodLabel}
          </span>
        </div>
      </section>
    </div>
  )
}