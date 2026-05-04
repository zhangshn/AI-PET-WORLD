/**
 * 当前文件负责：展示正式 world 页的轻量 HUD 雏形。
 */

import type { WorldHudBundle, HudMeter } from "../utils/worldHudMappers"

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

function HudMeterView({ meter }: { meter: HudMeter }) {
  return (
    <div className={styles.meterItem}>
      <div className={styles.meterTopRow}>
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
    <section className={styles.hud}>
      <div className={styles.block}>
        <div className={styles.blockHeader}>
          <span className={styles.eyebrow}>PET</span>
          <strong>{hud.pet.name}</strong>
        </div>

        <div className={styles.tags}>
          <span>{hud.pet.actionLabel}</span>
          <span>{hud.pet.moodLabel}</span>
          <span>{hud.pet.lifePhaseLabel}</span>
        </div>

        <div className={styles.meters}>
          <HudMeterView meter={hud.pet.meters.energy} />
          <HudMeterView meter={hud.pet.meters.hunger} />
        </div>
      </div>

      <div className={styles.block}>
        <div className={styles.blockHeader}>
          <span className={styles.eyebrow}>BUTLER</span>
          <strong>{hud.butler.name}</strong>
        </div>

        <div className={styles.tags}>
          <span>{hud.butler.taskLabel}</span>
          <span>{hud.butler.moodLabel}</span>
          <span>机会 {hud.butler.opportunityCount}</span>
        </div>

        <p className={styles.note}>{hud.butler.note}</p>
      </div>

      <div className={styles.block}>
        <div className={styles.blockHeader}>
          <span className={styles.eyebrow}>HOME</span>
          <strong>{hud.home.levelLabel}</strong>
        </div>

        <div className={styles.tags}>
          <span>{hud.home.statusLabel}</span>
          <span>{hud.home.stageLabel}</span>
          <span>{hud.home.focusLabel}</span>
        </div>

        <div className={styles.meters}>
          <HudMeterView meter={hud.home.meters.progress} />
          <HudMeterView meter={hud.home.meters.stability} />
        </div>
      </div>

      <div className={styles.block}>
        <div className={styles.blockHeader}>
          <span className={styles.eyebrow}>WORLD</span>
          <strong>{hud.world.dayLabel}</strong>
        </div>

        <div className={styles.tags}>
          <span>{hud.world.timeLabel}</span>
          <span>{hud.world.periodLabel}</span>
          <span>{hud.world.weatherLabel}</span>
          <span>{hud.world.pulseLabel}</span>
        </div>

        <p className={styles.note}>
          温度 {hud.world.temperatureLabel} · 刺激 {hud.world.stimuliCount}
        </p>
      </div>
    </section>
  )
}