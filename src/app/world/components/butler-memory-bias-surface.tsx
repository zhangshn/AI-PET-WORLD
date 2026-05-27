import type { WorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-schema"

import styles from "../world-route-page.styles.module.css"

export function ButlerMemoryBiasSurface(input: {
  saveRecord: WorldRuntimeSaveRecord
}) {
  const decision = input.saveRecord.lastButlerRuntimeDecision
  const traceContext = decision?.traceContext
  const motivationLabel = toMotivationLabel(decision?.selectedMotivation)
  const memorySeedCount = traceContext?.memorySeedCount ?? 0
  const memoryBiasLabel = toMemoryBiasLabel(
    traceContext?.memorySeedConsumeScore ?? 0,
    memorySeedCount
  )
  const focusLabels = toFocusLabels(traceContext?.memorySeedFocusKinds ?? [])
  const regionLabels = (traceContext?.memorySeedFocusRegions ?? []).slice(0, 3)
  const notes = buildButlerReasoningNotes({
    motivationLabel,
    memorySeedCount,
    memoryBiasLabel,
    focusLabels,
    regionLabels,
  })

  return (
    <article className={styles.panel} aria-label="Butler reasoning summary">
      <h2>Butler reasoning</h2>
      <div className={styles.resourceList}>
        <RuntimeInfoItem label="Current posture" value={motivationLabel} />
        <RuntimeInfoItem label="Memory bias" value={memoryBiasLabel} />
        <RuntimeInfoItem
          label="Remembered hints"
          value={memorySeedCount > 0 ? String(memorySeedCount) : "quiet"}
        />
      </div>
      <p>{buildButlerReasoningSummary(motivationLabel, memoryBiasLabel)}</p>
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

function toMotivationLabel(value: string | undefined): string {
  if (value === "continue_construction") return "continue building"
  if (value === "maintain_home") return "maintain home"
  if (value === "observe_world") return "observe world"
  if (value === "wait_for_resources") return "wait carefully"

  return "observe quietly"
}

function toMemoryBiasLabel(score: number, memorySeedCount: number): string {
  if (memorySeedCount <= 0 || score <= 0) return "quiet"
  if (score >= 8) return "clear"
  if (score >= 4) return "present"

  return "light"
}

function toFocusLabels(kinds: string[]): string[] {
  return kinds.slice(0, 3).map((kind) => {
    if (kind === "world_memory_seed") return "world memory hints"
    if (kind === "butler_memory_hint") return "caretaking hints"
    if (kind === "region_memory_hint") return "region familiarity"
    if (kind === "ecology_memory_hint") return "ecology care"
    if (kind === "relationship_memory_hint") return "relationship attention"

    return "world hints"
  })
}

function buildButlerReasoningSummary(
  motivationLabel: string,
  memoryBiasLabel: string
): string {
  if (memoryBiasLabel === "quiet") {
    return `The butler is choosing to ${motivationLabel}. The current decision is mostly guided by saved world state and resources.`
  }

  return `The butler is choosing to ${motivationLabel}. Saved traces now provide a ${memoryBiasLabel} memory bias, but they remain hints only.`
}

function buildButlerReasoningNotes(input: {
  motivationLabel: string
  memorySeedCount: number
  memoryBiasLabel: string
  focusLabels: string[]
  regionLabels: string[]
}): string[] {
  if (input.memorySeedCount <= 0) {
    return [
      "No stable memory hints are being used yet.",
      "The butler still follows resources, world state, and safe runtime rules.",
      "This summary only reads the saved world; it does not create actions.",
    ]
  }

  return [
    `${input.memorySeedCount} trace memory hints are being read as gentle bias, not direct orders.`,
    input.focusLabels.length > 0
      ? `Current hint focus: ${input.focusLabels.join(", ")}.`
      : "Current hints stay broad and do not force a specific action.",
    input.regionLabels.length > 0
      ? `The butler is aware of familiar regions such as ${input.regionLabels.join(", ")}.`
      : "The butler keeps these hints separate from formal world facts.",
  ]
}
