/**
 * 当前文件负责：展示紫微喜好画像生成的视觉变体样板。
 */

import {
  resolveSpriteVariants,
} from "../../sprite-system/sprite-system-gateway"
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
  "最终视觉必须走：ZiweiProbabilityProfile → PreferenceProfile → VisualDNA → SpriteVariant → Sprite Sheet → PrefabVariant → SceneLayout。",
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

const archetypeDescriptions: Record<string, string> = {
  structured_builder:
    "秩序建设型更重视结构、路径、地基和储物。管家倾向先整理环境、建立秩序，再逐步建设稳定家园。",
  warm_caretaker:
    "温暖照护型更重视舒适、陪伴和安全感。管家会优先布置宠物床、食物碗、水碗和暖色照护角。",
  protective_keeper:
    "边界守护型更重视防护、边界和观察点。管家会优先考虑围栏、遮蔽、安全角落和可观察的家园结构。",
  aesthetic_organizer:
    "审美整理型更重视花园、装饰和明亮氛围。管家会更早加入花草、窗光、装饰性路径和活泼宠物元素。",
  quiet_maintainer:
    "安静维护型更重视低调、稳定和长期维护。家园倾向安静树荫、低饱和色彩、简洁住所和安静观察型宠物。",
  adaptive_planner:
    "适应规划型更重视动态调整。管家不会固定走单一模板，而是根据资源、宠物状态和当前阶段混合规划。",
}

const chineseLabels: Record<string, string> = {
  earth_warm: "土色暖调",
  wood_green: "木系绿色",
  moon_soft: "月色柔调",
  metal_clear: "金属清晰调",
  water_quiet: "水系安静调",
  fire_bright: "火系明亮调",
  steady_compact: "稳定紧凑轮廓",
  soft_round: "柔和圆润轮廓",
  guarded_upright: "守护直立轮廓",
  elegant_light: "轻盈审美轮廓",
  quiet_simple: "安静简洁轮廓",
  balanced_adaptive: "平衡适应轮廓",
  stable_attached: "稳定依恋型宠物",
  soft_companion: "柔软陪伴型宠物",
  alert_guardian: "警觉守护型宠物",
  curious_playful: "好奇活泼型宠物",
  quiet_observer: "安静观察型宠物",
  adaptive_partner: "适应伙伴型宠物",
  orderly_structured: "秩序结构型家园",
  warm_care_first: "温暖照护优先家园",
  protected_boundary: "边界防护型家园",
  flowered_aesthetic: "花园审美型家园",
  quiet_minimal: "安静极简型家园",
  adaptive_mixed: "适应混合型家园",
  neat_low_grass: "整齐低草花园",
  warm_flower_patch: "温暖花丛花园",
  protected_shrub_edge: "防护灌木边界",
  decorative_garden: "装饰花园",
  quiet_shade: "安静树荫",
  mixed_natural: "混合自然花园",
  straight_frame: "直线框架住所",
  soft_canopy: "柔和遮蔽住所",
  reinforced_edge: "加固边界住所",
  decorated_roof: "装饰屋顶住所",
  low_quiet_shelter: "低调安静住所",
  adaptive_shelter: "适应型住所",
  storage_first: "储物优先",
  comfort_first: "舒适优先",
  safety_first: "安全优先",
  beauty_first: "美观优先",
  stability_first: "稳定优先",
  context_first: "情境优先",
}

function getChineseLabel(value: string) {
  return chineseLabels[value] ?? value
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

function renderSpriteMetadata(spriteVariantIds: string[]) {
  const resolvedSprites = resolveSpriteVariants(spriteVariantIds)

  if (resolvedSprites.length === 0) {
    return <p>当前外观变体还没有绑定 Sprite Sheet 元数据。</p>
  }

  return resolvedSprites.map(({ frame, mapping }) => (
    <p key={mapping.spriteVariantId}>
      {frame.name}：{mapping.spriteVariantId} → {frame.sheetId} / {frame.id} / {frame.rect.width}x{frame.rect.height}px / 占地 {frame.gridSize.columns}x{frame.gridSize.rows}
    </p>
  ))
}

export default function VisualVariantTestPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>SPRITE-02</p>
        <h1>Ziwei Visual Render Samples / 紫微视觉渲染样板</h1>
        <p>
          本页面用于验证：14 主星 + 24 组合经过紫微概率解释和喜好画像后，
          能否生成不同的管家、宠物、颜色、家园风格和场景方向，并进一步解析到 Sprite Sheet 元数据。
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
          PreferenceProfile → VisualDNA → SpriteVariant → Sprite Sheet →
          PrefabVariant → SceneLayout
        </p>
      </section>

      <section className={styles.variantGrid}>
        {mockVisualGenerationResults.map((result) => {
          const { visualDNA, spriteVariant, prefabVariant, sceneLayoutVariant } =
            result
          const toneClass = getToneClass(visualDNA.colorTone)
          const archetypeClass = getArchetypeClass(visualDNA.archetype)
          const title = mockVisualArchetypeLabels[visualDNA.archetype]
          const description = archetypeDescriptions[visualDNA.archetype]
          const spriteVariantIds = [
            spriteVariant.butlerSprite,
            spriteVariant.petSprite,
            spriteVariant.treeSprite,
            spriteVariant.shelterSprite,
            spriteVariant.houseSprite,
            spriteVariant.careCornerSprite,
            spriteVariant.adoptionCenterSprite,
          ]

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

              <p>{description}</p>

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
                  <h3>VisualDNA / 视觉 DNA</h3>
                  <p>颜色：{getChineseLabel(visualDNA.colorTone)} / {visualDNA.colorTone}</p>
                  <p>管家：{getChineseLabel(visualDNA.butlerSilhouette)} / {visualDNA.butlerSilhouette}</p>
                  <p>宠物：{getChineseLabel(visualDNA.petMatchType)} / {visualDNA.petMatchType}</p>
                  <p>家园：{getChineseLabel(visualDNA.homeStyle)} / {visualDNA.homeStyle}</p>
                  <p>花园：{getChineseLabel(visualDNA.gardenStyle)} / {visualDNA.gardenStyle}</p>
                  <p>住所：{getChineseLabel(visualDNA.shelterStyle)} / {visualDNA.shelterStyle}</p>
                  <p>照护优先级：{getChineseLabel(visualDNA.carePriority)} / {visualDNA.carePriority}</p>
                </div>
                <div>
                  <h3>Sprite / 外观变体</h3>
                  <p>管家外观：{spriteVariant.butlerSprite}</p>
                  <p>宠物外观：{spriteVariant.petSprite}</p>
                  <p>树木外观：{spriteVariant.treeSprite}</p>
                  <p>临时住所外观：{spriteVariant.shelterSprite}</p>
                  <p>基础小屋外观：{spriteVariant.houseSprite}</p>
                  <p>照护角外观：{spriteVariant.careCornerSprite}</p>
                  <p>领养中心外观：{spriteVariant.adoptionCenterSprite}</p>
                </div>
                <div>
                  <h3>Sprite Sheet / 像素资源元数据</h3>
                  {renderSpriteMetadata(spriteVariantIds)}
                </div>
                <div>
                  <h3>Prefab / 世界对象</h3>
                  <p>管家对象：{prefabVariant.butlerPrefab}</p>
                  <p>宠物对象：{prefabVariant.petPrefab}</p>
                  <p>照护角对象：{prefabVariant.careCornerPrefab}</p>
                  <p>住所对象：{prefabVariant.shelterPrefab}</p>
                  <p>基础小屋对象：{prefabVariant.basicHousePrefab}</p>
                  <p>花园对象：{prefabVariant.gardenPrefab}</p>
                  <p>领养中心对象：{prefabVariant.adoptionCenterPrefab}</p>
                </div>
                <div>
                  <h3>Scene / 场景方向</h3>
                  <p>初始家园：{sceneLayoutVariant.initialHomeScene}</p>
                  <p>照护点：{sceneLayoutVariant.carePointScene}</p>
                  <p>临时住所：{sceneLayoutVariant.temporaryShelterScene}</p>
                  <p>基础小屋：{sceneLayoutVariant.basicHomeScene}</p>
                  <p>领养抵达：{sceneLayoutVariant.adoptionArrivalScene}</p>
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
