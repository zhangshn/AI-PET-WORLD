/**
 * 当前文件负责：展示世界底层 Runtime 状态。
 */

import type { WorldRuntimeState } from "@/world/runtime/world-runtime"

import styles from "@/styles/world-styles/world-runtime-panel.module.css"

type Props = {
  runtime: WorldRuntimeState | null
}

export default function WorldRuntimePanel({ runtime }: Props) {
  if (!runtime) {
    return (
      <section className={styles.panel}>
        <h2 className={styles.title}>世界运行层 / World Runtime</h2>
        <p className={styles.empty}>世界运行层尚未初始化。</p>
      </section>
    )
  }

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>世界运行层 / World Runtime</h2>
          <p className={styles.subtitle}>
            地图、生态群落、天气影响、文明需求与系统 NPC。
          </p>
        </div>

        <span className={styles.badge}>Tick {runtime.tick}</span>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <span className={styles.label}>地图 / Map</span>
          <strong>{runtime.map.id}</strong>
          <p>
            {runtime.map.size.width} × {runtime.map.size.height} / tile{" "}
            {runtime.map.tileSize}
          </p>
        </div>

        <div className={styles.card}>
          <span className={styles.label}>生态群落 / Biome</span>
          <strong>{runtime.biome.type}</strong>
          <p>{runtime.biome.description}</p>
        </div>

        <div className={styles.card}>
          <span className={styles.label}>天气影响 / Weather Effect</span>
          <p>visibility {runtime.weatherEffect.visibilityModifier}</p>
          <p>movement {runtime.weatherEffect.movementModifier}</p>
          <p>creature {runtime.weatherEffect.creatureSpawnModifier}</p>
          <p>comfort {runtime.weatherEffect.comfortModifier}</p>
        </div>

        <div className={styles.card}>
          <span className={styles.label}>文明 / Civilization</span>
          <p>NPC 数量：{runtime.civilization.npcs.length}</p>
          <p>职业需求：{runtime.civilization.professionNeeds.length}</p>
        </div>
      </div>

      <div className={styles.section}>
        <h3>职业需求 / Profession Needs</h3>

        {runtime.civilization.professionNeeds.length === 0 ? (
          <p className={styles.empty}>当前没有紧急职业需求。</p>
        ) : (
          <div className={styles.list}>
            {runtime.civilization.professionNeeds.map((need) => (
              <article key={need.type} className={styles.item}>
                <strong>{need.type}</strong>
                <span>urgency {need.urgency}</span>
                <p>{need.reason}</p>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className={styles.section}>
        <h3>系统 NPC / System NPCs</h3>

        {runtime.civilization.npcs.length === 0 ? (
          <p className={styles.empty}>当前没有系统 NPC。</p>
        ) : (
          <div className={styles.list}>
            {runtime.civilization.npcs.map((npc) => (
              <article key={npc.id} className={styles.item}>
                <strong>{npc.name}</strong>
                <span>{npc.profession}</span>
                <p>
                  position ({Math.round(npc.position.x)},{" "}
                  {Math.round(npc.position.y)})
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}