/**
 * 当前文件负责：展示世界刺激列表，并区分环境、实体与空间来源。
 */

import type { WorldStimulus } from "@/ai/gateway"

import styles from "@/styles/world-styles/world-stimulus-panel.module.css"

type Props = {
  stimuli: WorldStimulus[]
}

type StimulusGroupKey = "entity" | "environment" | "spatial" | "dynamic"

type StimulusGroup = {
  key: StimulusGroupKey
  title: string
  description: string
  stimuli: WorldStimulus[]
}

export default function WorldStimulusPanel({ stimuli }: Props) {
  const groups = buildStimulusGroups(stimuli)

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>世界刺激</h2>
          <p className={styles.subtitle}>
            世界里的对象、环境与区域正在持续影响宠物的感知。
          </p>
        </div>

        <span className={styles.countBadge}>
          {stimuli.length} 个活跃
        </span>
      </div>

      {stimuli.length === 0 && (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>·</span>
          <p className={styles.emptyTitle}>当前没有活跃刺激</p>
          <p className={styles.emptyText}>
            当风、光影、树影、花香、水声或蝴蝶移动出现时，这里会显示宠物可感知到的世界变化。
          </p>
        </div>
      )}

      {groups.map((group) => {
        if (group.stimuli.length === 0) return null

        return (
          <div key={group.key} className={styles.group}>
            <div className={styles.groupHeader}>
              <div>
                <h3 className={styles.groupTitle}>{group.title}</h3>
                <p className={styles.groupDescription}>{group.description}</p>
              </div>

              <span className={styles.groupCount}>
                {group.stimuli.length}
              </span>
            </div>

            <div className={styles.list}>
              {group.stimuli.map((stimulus) => (
                <StimulusCard
                  key={stimulus.id}
                  stimulus={stimulus}
                />
              ))}
            </div>
          </div>
        )
      })}
    </section>
  )
}

function StimulusCard({ stimulus }: { stimulus: WorldStimulus }) {
  const sourceLabel = getStimulusSourceLabel(stimulus)
  const typeLabel = getStimulusTypeLabel(stimulus.type)
  const categoryLabel = getStimulusCategoryLabel(stimulus.category)
  const intensityLabel = getStimulusIntensityLabel(stimulus.intensity)

  return (
    <article className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <div className={styles.typeLine}>
            <span className={styles.typeIcon}>
              {getStimulusIcon(stimulus)}
            </span>
            <span className={styles.typeLabel}>{typeLabel}</span>
          </div>

          <p className={styles.summary}>{stimulus.summary}</p>
        </div>

        <span className={styles.intensityBadge}>
          {intensityLabel}
        </span>
      </div>

      <div className={styles.metaGrid}>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>分类</span>
          <span className={styles.metaValue}>{categoryLabel}</span>
        </div>

        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>来源</span>
          <span className={styles.metaValue}>{sourceLabel}</span>
        </div>

        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>位置</span>
          <span className={styles.metaValue}>
            {formatPosition(stimulus.worldPosition)}
          </span>
        </div>

        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>持续</span>
          <span className={styles.metaValue}>
            {stimulus.durationTick} Tick
          </span>
        </div>
      </div>

      {stimulus.tags.length > 0 && (
        <div className={styles.tags}>
          {stimulus.tags.slice(0, 5).map((tag) => (
            <span key={tag} className={styles.tag}>
              {tag}
            </span>
          ))}
        </div>
      )}
    </article>
  )
}

function buildStimulusGroups(stimuli: WorldStimulus[]): StimulusGroup[] {
  return [
    {
      key: "entity",
      title: "实体刺激",
      description: "由树、花、水、蝴蝶等世界对象产生。",
      stimuli: stimuli.filter((stimulus) => stimulus.category === "entity"),
    },
    {
      key: "environment",
      title: "环境刺激",
      description: "由天气、光影、温度、风等环境变化产生。",
      stimuli: stimuli.filter((stimulus) => stimulus.category === "environment"),
    },
    {
      key: "dynamic",
      title: "动态刺激",
      description: "由落叶、阴影、远处动静等短暂变化产生。",
      stimuli: stimuli.filter((stimulus) => stimulus.category === "dynamic"),
    },
    {
      key: "spatial",
      title: "空间刺激",
      description: "由安静区域、温暖区域等空间状态产生。",
      stimuli: stimuli.filter((stimulus) => stimulus.category === "spatial"),
    },
  ]
}

function getStimulusSourceLabel(stimulus: WorldStimulus): string {
  if (!stimulus.source) {
    if (stimulus.category === "environment") return "世界环境"
    if (stimulus.category === "spatial") return "生态区域"
    if (stimulus.category === "dynamic") return "动态变化"

    return "未知来源"
  }

  if (stimulus.source.kind === "world_entity") {
    return stimulus.source.name ?? stimulus.source.type ?? "世界实体"
  }

  if (stimulus.source.kind === "ecology_zone") {
    return stimulus.source.name ?? stimulus.source.type ?? "生态区域"
  }

  return stimulus.source.name ?? "世界环境"
}

function getStimulusTypeLabel(type: WorldStimulus["type"]): string {
  switch (type) {
    case "breeze":
      return "微风流动"
    case "light_shift":
      return "光影变化"
    case "temperature_drop":
      return "温度下降"
    case "butterfly":
      return "蝴蝶掠过"
    case "falling_leaf":
      return "落叶飘动"
    case "distant_sound":
      return "远处动静"
    case "shadow_motion":
      return "阴影移动"
    case "quiet_zone":
      return "安静区域"
    case "warm_zone":
      return "温暖区域"
    case "tree_presence":
      return "树影存在"
    case "flower_scent":
      return "花香"
    case "water_sound":
      return "水声"
    case "entity_motion":
      return "实体移动"
    default:
      return type
  }
}

function getStimulusCategoryLabel(
  category: WorldStimulus["category"]
): string {
  switch (category) {
    case "environment":
      return "环境"
    case "dynamic":
      return "动态"
    case "spatial":
      return "空间"
    case "entity":
      return "实体"
    default:
      return category
  }
}

function getStimulusIntensityLabel(
  intensity: WorldStimulus["intensity"]
): string {
  switch (intensity) {
    case "low":
      return "轻微"
    case "medium":
      return "明显"
    case "high":
      return "强烈"
    default:
      return intensity
  }
}

function getStimulusIcon(stimulus: WorldStimulus): string {
  if (stimulus.category === "entity") {
    if (stimulus.type === "tree_presence") return "🌳"
    if (stimulus.type === "flower_scent") return "🌸"
    if (stimulus.type === "water_sound") return "💧"
    if (stimulus.type === "entity_motion") return "🦋"

    return "●"
  }

  if (stimulus.type === "breeze") return "〰"
  if (stimulus.type === "light_shift") return "✦"
  if (stimulus.type === "temperature_drop") return "❄"
  if (stimulus.type === "falling_leaf") return "🍂"
  if (stimulus.type === "distant_sound") return "♪"
  if (stimulus.type === "shadow_motion") return "◐"
  if (stimulus.type === "quiet_zone") return "○"
  if (stimulus.type === "warm_zone") return "☀"

  return "·"
}

function formatPosition(position: WorldStimulus["worldPosition"]): string {
  return `${Math.round(position.x)}, ${Math.round(position.y)}`
}