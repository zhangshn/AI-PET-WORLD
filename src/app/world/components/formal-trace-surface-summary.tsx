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
    <article className={styles.panel} aria-label="World trace summary">
      <h2>World traces</h2>
      <div className={styles.resourceList}>
        <RuntimeInfoItem
          label="Observed traces"
          value={visibleTraceCount > 0 ? String(visibleTraceCount) : "quiet"}
        />
        <RuntimeInfoItem label="Presence" value={averageIntensityLabel} />
        <RuntimeInfoItem
          label="Main signs"
          value={
            mainVisualKinds.length > 0
              ? mainVisualKinds.join(", ")
              : "none yet"
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
  if (value >= 70) return "clear"
  if (value >= 38) return "noticeable"
  if (value > 0) return "light"

  return "quiet"
}

function toVisualKindLabel(visualKind: TraceVisualKind): string {
  if (visualKind === "flattened_grass") return "soft ground use"
  if (visualKind === "exposed_soil") return "exposed soil"
  if (visualKind === "worn_ground") return "worn ground"
  if (visualKind === "moss") return "moss"
  if (visualKind === "mushroom") return "mushroom growth"
  if (visualKind === "repaired_ground") return "repaired ground"
  if (visualKind === "maintained_area") return "maintained areas"
  if (visualKind === "faded_area") return "faded areas"
  if (visualKind === "waiting_spot") return "waiting spots"
  if (visualKind === "comfort_spot") return "comfort spots"
  if (visualKind === "attention_glow") return "attention signs"

  return "quiet ground"
}

function buildUserFacingSummary(
  visibleTraceCount: number,
  averageIntensityLabel: string
): string {
  if (visibleTraceCount <= 0) {
    return "The world is quiet for now. No clear surface traces are visible from the current saved state."
  }

  if (averageIntensityLabel === "clear") {
    return "The world has several clear living traces. Some areas are visibly shaped by repeated use."
  }

  if (averageIntensityLabel === "noticeable") {
    return "The world has started to show noticeable traces of use and care."
  }

  return "The world already holds a few light traces. The butler can continue observing how they settle."
}

function buildUserFacingTraceNotes(input: {
  visibleTraceCount: number
  averageIntensityLabel: string
  mainVisualKinds: string[]
}): string[] {
  if (input.visibleTraceCount <= 0) {
    return [
      "No clear surface traces are visible yet.",
      "Future runtime ticks may leave readable changes in the world.",
    ]
  }

  return [
    "These traces come from world runtime, not direct player placement.",
    input.mainVisualKinds.length > 0
      ? `Most visible signs are ${input.mainVisualKinds.join(", ")}.`
      : "The visible signs are still soft and early.",
    input.averageIntensityLabel === "light"
      ? "Some traces are still light, so the butler will keep watching them."
      : "The trace surface is stable enough to be noticed in the formal world view.",
  ].slice(0, 3)
}
