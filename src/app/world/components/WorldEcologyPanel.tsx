/**
 * 当前文件负责：展示世界生态环境状态与世界功能区域。
 */

import type { WorldEcologyState } from "@/world/ecology/ecology-engine"

import styles from "@/styles/world-styles/world-ecology-panel.module.css"

type Props = {
  ecology: WorldEcologyState | null
}

export default function WorldEcologyPanel({ ecology }: Props) {
  if (!ecology) {
    return (
      <section className={styles.panel}>
        <h2 className={styles.title}>世界生态 / World Ecology</h2>
        <p className={styles.empty}>生态系统尚未初始化。</p>
      </section>
    )
  }

  const { environment, zones } = ecology

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>世界生态 / World Ecology</h2>
          <p className={styles.subtitle}>
            世界环境底盘、天气、光照、风、湿度与功能区域。
          </p>
        </div>

        <span className={styles.badge}>
          {environment.activeWeather} / {environment.environmentMood}
        </span>
      </div>

      <div className={styles.grid}>
        <div className={styles.metric}>
          <span className={styles.label}>温度</span>
          <strong>{environment.temperature}°C</strong>
        </div>

        <div className={styles.metric}>
          <span className={styles.label}>湿度</span>
          <strong>{environment.humidity}</strong>
        </div>

        <div className={styles.metric}>
          <span className={styles.label}>风力</span>
          <strong>{environment.windLevel}</strong>
        </div>

        <div className={styles.metric}>
          <span className={styles.label}>光照</span>
          <strong>{environment.lightLevel}</strong>
        </div>

        <div className={styles.metric}>
          <span className={styles.label}>稳定度</span>
          <strong>{environment.stability}</strong>
        </div>

        <div className={styles.metric}>
          <span className={styles.label}>季节</span>
          <strong>{environment.season}</strong>
        </div>
      </div>

      <div className={styles.zoneBlock}>
        <h3 className={styles.sectionTitle}>世界区域 / Zones</h3>

        <div className={styles.zoneList}>
          {zones.map((zone) => (
            <article
              key={zone.id}
              className={styles.zoneCard}
            >
              <div className={styles.zoneHeader}>
                <strong>{zone.name}</strong>
                <span>{zone.type}</span>
              </div>

              <p className={styles.zoneMeta}>
                x:{zone.x} y:{zone.y} r:{zone.radius}
              </p>

              <div className={styles.effectGrid}>
                <span>comfort {zone.effect.comfortBonus}</span>
                <span>safety {zone.effect.safetyBonus}</span>
                <span>curiosity {zone.effect.curiosityBonus}</span>
                <span>rest {zone.effect.restBonus}</span>
                <span>stress {zone.effect.stressModifier}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}