/**
 * 当前文件负责组合正式世界体验页面。
 */

import type { WorldExperienceModel } from "@/world/visualization/world-experience-schema"

import { ButlerPresenceCard } from "./ButlerPresenceCard"
import { ConstructionStoryTimeline } from "./ConstructionStoryTimeline"
import { HomeGrowthOverview } from "./HomeGrowthOverview"
import { PetPresenceCard } from "./PetPresenceCard"
import { WorldEventStoryFeed } from "./WorldEventStoryFeed"
import { WorldExperienceControls } from "./WorldExperienceControls"
import { WORLD_EXPERIENCE_STYLES as styles } from "./world-experience-styles"
import { WorldHeroNarrative } from "./WorldHeroNarrative"

type WorldExperiencePageProps = {
  model: WorldExperienceModel
  onManualAdvanceConstruction: () => void
  onResetLocalHomeMap: () => void
}

export function WorldExperiencePage({
  model,
  onManualAdvanceConstruction,
  onResetLocalHomeMap,
}: WorldExperiencePageProps) {
  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <header style={styles.hero}>
          <p style={styles.eyebrow}>{model.hero.statusLabel}</p>
          <h1 style={styles.title}>{model.hero.title}</h1>
          <p style={styles.subtitle}>{model.hero.subtitle}</p>
          <span style={styles.status}>你的家园正在被自主照看</span>
        </header>

        <div style={styles.mainGrid}>
          <PetPresenceCard pet={model.pet} />
          <WorldHeroNarrative hero={model.hero} />
          <ButlerPresenceCard butler={model.butler} />
          <HomeGrowthOverview homeGrowth={model.homeGrowth} />
          <ConstructionStoryTimeline construction={model.construction} />
          <WorldEventStoryFeed events={model.events} />
          <WorldExperienceControls
            onManualAdvanceConstruction={onManualAdvanceConstruction}
            onResetLocalHomeMap={onResetLocalHomeMap}
          />
        </div>
      </div>
    </main>
  )
}
