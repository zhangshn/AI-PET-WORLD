import type { FormalVisualModel } from "@/world/formal-visual-model/formal-visual-model-gateway"
import type { TraceVisualKind } from "@/world/trace"

import styles from "../world-route-page.styles.module.css"

export function FormalTraceSurfaceSummary(input: {
  formalVisualModel: FormalVisualModel
}) {
  const projection = input.formalVisualModel.traceVisualProjection
  const summary = projection?.summary
  const visibleTraceCount = summary?.visibleItems ?? 0
  const mainVisualKinds = getMainVisualKinds(summary?.byVisualKind)
  const averageIntensityLabel = toAverageIntensityLabel(
    summary?.averageIntensity ?? 0
  )
  const notes = buildUserFacingTraceNotes({
    visibleTraceCount,
    averageIntensityLabel,
    mainVisualKinds,
  })

  return (
    <article className={styles.panel} aria-label="世界痕迹摘要">
      <h2>世界痕迹</h2>
      <div className={styles.resourceList}>
        <RuntimeInfoItem
          label="可见痕迹"
          value={visibleTraceCount > 0 ? String(visibleTraceCount) : "安静"}
        />
        <RuntimeInfoItem label="痕迹强度" value={averageIntensityLabel} />
        <RuntimeInfoItem
          label="主要迹象"
          value={
            mainVisualKinds.length > 0
              ? mainVisualKinds.join("、")
              : "暂未形成"
          }
        />
      </div>
      <p>{buildUserFacingSummary(visibleTraceCount, averageIntensityLabel)}</p>
      <ul className={styles.milestoneList}>
        {notes.map((note) => (
          <li className={styles.milestoneItem} key={note}>
            <span className={styles.statusDot} data-status="ready" />
            <p>{note}</p>
          </li>
        ))}
      </ul>
    </article>
  )
}

function RuntimeInfoItem(input: { label: string; value: string }) {
  return (
    <div className={styles.resourceItem}>
      <div className={styles.resourceHeader}>
        <strong>{input.label}</strong>
        <span>{input.value}</span>
      </div>
    </div>
  )
}

function getMainVisualKinds(
  byVisualKind: Partial<Record<TraceVisualKind, number>> | undefined
): string[] {
  if (!byVisualKind) return []

  return Object.entries(byVisualKind)
    .filter(([, count]) => Number(count) > 0)
    .sort((left, right) => Number(right[1]) - Number(left[1]))
    .slice(0, 3)
    .map(([visualKind]) => toVisualKindLabel(visualKind as TraceVisualKind))
}

function toAverageIntensityLabel(value: number): string {
  if (value >= 70) return "清晰"
  if (value >= 38) return "明显"
  if (value > 0) return "轻微"

  return "安静"
}

function toVisualKindLabel(visualKind: TraceVisualKind): string {
  if (visualKind === "flattened_grass") return "草地压痕"
  if (visualKind === "exposed_soil") return "裸露土壤"
  if (visualKind === "worn_ground") return "地面磨痕"
  if (visualKind === "moss") return "苔藓"
  if (visualKind === "mushroom") return "蘑菇生长"
  if (visualKind === "repaired_ground") return "修复地面"
  if (visualKind === "maintained_area") return "维护区域"
  if (visualKind === "faded_area") return "褪色区域"
  if (visualKind === "waiting_spot") return "等待位置"
  if (visualKind === "comfort_spot") return "安心位置"
  if (visualKind === "attention_glow") return "关注迹象"

  return "安静地面"
}

function buildUserFacingSummary(
  visibleTraceCount: number,
  averageIntensityLabel: string
): string {
  if (visibleTraceCount <= 0) {
    return "当前家园还很安静，暂时没有清晰可见的表层痕迹。"
  }

  if (averageIntensityLabel === "清晰") {
    return "家园里已经出现几处清晰的生活痕迹，一些区域正在被反复使用慢慢塑形。"
  }

  if (averageIntensityLabel === "明显") {
    return "家园已经开始出现明显的使用和照料痕迹。"
  }

  return "家园已经留下几处轻微痕迹，管家会继续观察它们如何稳定下来。"
}

function buildUserFacingTraceNotes(input: {
  visibleTraceCount: number
  averageIntensityLabel: string
  mainVisualKinds: string[]
}): string[] {
  if (input.visibleTraceCount <= 0) {
    return [
      "当前还没有清晰的表层痕迹。",
      "未来的显式 runtime Tick 可能会让世界留下可读变化。",
    ]
  }

  return [
    "这些痕迹来自世界运行，不是玩家直接摆放生成。",
    input.mainVisualKinds.length > 0
      ? `最明显的迹象是${input.mainVisualKinds.join("、")}。`
      : "当前迹象还很轻，只能作为早期观察。",
    input.averageIntensityLabel === "轻微"
      ? "部分痕迹仍然很轻，管家会继续观察它们。"
      : "这些痕迹已经稳定到可以进入正式世界视图。",
  ].slice(0, 3)
}
