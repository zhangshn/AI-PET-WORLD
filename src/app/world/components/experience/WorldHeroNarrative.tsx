/**
 * 当前文件负责展示世界当前叙事。
 */

import type { WorldExperienceModel } from "@/world/visualization/world-experience-schema"

import { WORLD_EXPERIENCE_STYLES as styles } from "./world-experience-styles"

type WorldHeroNarrativeProps = {
  hero: WorldExperienceModel["hero"]
}

export function WorldHeroNarrative({ hero }: WorldHeroNarrativeProps) {
  return (
    <section style={styles.narrativeCard}>
      <h2 style={styles.cardTitle}>现在家园里正在发生的事</h2>
      <p style={styles.narrative}>{hero.currentNarrative}</p>
    </section>
  )
}
