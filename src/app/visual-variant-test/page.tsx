/**
 * 当前文件负责：展示紫微喜好画像生成的视觉变体样板。
 */

import {
  mockVisualArchetypeLabels,
  mockVisualGenerationResults,
} from "../../visual-system/visual-system.mock"

import styles from "./visual-variant-test.module.css"

const coreRequirements = [
  "紫微斗数是第一核心，是产品护城河，不是装饰功能。",
  "八字不是并列核心，只在用户没有准确出生时间时作为辅助补全。",
  "用户真实出生信息生成管家源头人格、管理风格和初始形象。",
  "管家不是工具人，是用户生命信息映射出的自主意识管理者。",
  "宠物不是随机宠物，而是根据用户紫微人格倾向和当前阶段匹配。",
  "不同玩家应该生成不同管家长相、不同宠物类型、不同颜色、不同家园风格。",
  "最终视觉必须走：ZiweiProbabilityProfile → PreferenceProfile → VisualDNA → SpriteVariant → PrefabVariant → SceneLayout。",
]

const toneClassMap: Record<string, string> = {
  earth_warm: styles.toneEarthWarm,
  wood_green: styles.toneWoodGreen,
  moon_soft: styles.toneMoonSoft,
  metal_clear: styles.toneMetalClear,
  water_quiet: styles.toneWaterQuiet,
  fire_bright: styles.toneFireBright,
}

const archetypeClassMap: Record<string, string> = {
  structured_builder: styles.structuredBuilder,
  warm_caretaker: styles.warmCaretaker,
  protective_keeper: styles.protectiveKeeper,
  aesthetic_organizer: styles.aestheticOrganizer,
  quiet_maintainer: styles.quietMaintainer,
  adaptive_planner: styles.adaptivePlanner,
}

function getToneClass(tone: string) {
  return toneClassMap[tone] ?? styles.toneMoonSoft
}

function getArchetypeClass(archetype: string) {
  return archetypeClassMap[archetype] ?? styles.adaptivePlanner
}

function renderMetric(label: string, value: number) {
  return (
    <div className={styles.metric} key={label}>
      <span>{label}</span>
      <strong>{value}</strong>
      <div className={styles.metricTrack}>
        <i style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

export default function VisualVariantTestPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>DESIGN-02</p>
        <h1>Ziwei Visual Render Samples / 紫微视觉渲染样板</h1>
        <p>
          本页面用于验证：14 主星 + 24 组合经过紫微概率解释和喜好画像后，
          能否生成不同的管家、宠物、颜色、家园风格和场景方向。
        </p>
      </section>

      <section className={styles.section}>
        <h2>核心内容锁定</h2>
        <div className={styles.coreGrid}>
          {coreRequirements.map((item, index) => (
            <article key={item} className={styles.coreCard}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{item}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.pipeline}>
        <h2>当前生成链路</h2>
        <p>
          真实出生信息 → 紫微斗数主算法 → ZiweiProbabilityProfile →
          PreferenceProfile → VisualDNA → SpriteVariant → PrefabVariant →
          SceneLayout
        </p>
      </section>

      <section className={styles.variantGrid}>
        {mockVisualGenerationResults.map((result) => {
          const { visualDNA, spriteVariant, prefabVariant, sceneLayoutVariant } =
            result
          const toneClass = getToneClass(visualDNA.colorTone)
          const archetypeClass = getArchetypeClass(visualDNA.archetype)
          const title = mockVisualArchetypeLabels[visualDNA.archetype]

          return (
            <article
              key={`${visualDNA.archetype}-${visualDNA.petMatchType}-${visualDNA.homeStyle}`}
              className={`${styles.variantCard} ${toneClass} ${archetypeClass}`}
            >
              <header className={styles.cardHeader}>
                <div>
                  <p className={styles.eyebrow}>Ziwei VisualDNA</p>
                  <h2>{title}</h2>
                </div>
                <span className={styles.confidence}>{visualDNA.confidence}</span>
              </header>

              <div className={styles.previewStage}>
                <div className={styles.landPatch}>
                  <span className={styles.pathLine} />
                  <span className={styles.treeA} />
                  <span className={styles.treeB} />
                  <span className={styles.gardenPatch} />
                  <span className={styles.careCorner} />
                  <span className={styles.shelter} />
                  <span className={styles.butler} />
                  <span className={styles.pet} />
                </div>
              </div>

              <div className={styles.infoGrid}>
                <div>
                  <h3>VisualDNA</h3>
                  <p>颜色：{visualDNA.colorTone}</p>
                  <p>管家：{visualDNA.butlerSilhouette}</p>
                  <p>宠物：{visualDNA.petMatchType}</p>
                  <p>家园：{visualDNA.homeStyle}</p>
                  <p>花园：{visualDNA.gardenStyle}</p>
                </div>
                <div>
                  <h3>Sprite</h3>
                  <p>{spriteVariant.butlerSprite}</p>
                  <p>{spriteVariant.petSprite}</p>
                  <p>{spriteVariant.shelterSprite}</p>
                  <p>{spriteVariant.houseSprite}</p>
                </div>
                <div>
                  <h3>Prefab</h3>
                  <p>{prefabVariant.butlerPrefab}</p>
                  <p>{prefabVariant.petPrefab}</p>
                  <p>{prefabVariant.careCornerPrefab}</p>
                  <p>{prefabVariant.shelterPrefab}</p>
                </div>
                <div>
                  <h3>Scene</h3>
                  <p>{sceneLayoutVariant.initialHomeScene}</p>
                  <p>{sceneLayoutVariant.carePointScene}</p>
                  <p>{sceneLayoutVariant.temporaryShelterScene}</p>
                </div>
              </div>

              <div className={styles.metricsGrid}>
                {renderMetric("秩序 / 自然", visualDNA.orderVsNature)}
                {renderMetric("温暖 / 距离", visualDNA.warmthVsDistance)}
                {renderMetric("防护需求", visualDNA.protectionNeed)}
                {renderMetric("装饰需求", visualDNA.decorationNeed)}
              </div>
            </article>
          )
        })}
      </section>
    </main>
  )
}
