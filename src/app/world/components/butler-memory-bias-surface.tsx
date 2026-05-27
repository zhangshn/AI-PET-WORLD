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
    <article className={styles.panel} aria-label="管家判断摘要">
      <h2>管家判断</h2>
      <div className={styles.resourceList}>
        <RuntimeInfoItem label="当前姿态" value={motivationLabel} />
        <RuntimeInfoItem label="记忆偏置" value={memoryBiasLabel} />
        <RuntimeInfoItem
          label="记住的提示"
          value={memorySeedCount > 0 ? String(memorySeedCount) : "安静"}
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
  if (value === "continue_construction") return "继续建设"
  if (value === "maintain_home") return "维护家园"
  if (value === "observe_world") return "观察世界"
  if (value === "wait_for_resources") return "谨慎等待"

  return "安静观察"
}

function toMemoryBiasLabel(score: number, memorySeedCount: number): string {
  if (memorySeedCount <= 0 || score <= 0) return "安静"
  if (score >= 8) return "清晰"
  if (score >= 4) return "存在"

  return "轻微"
}

function toFocusLabels(kinds: string[]): string[] {
  return kinds.slice(0, 3).map((kind) => {
    if (kind === "world_memory_seed") return "世界记忆提示"
    if (kind === "butler_memory_hint") return "照看提示"
    if (kind === "region_memory_hint") return "区域熟悉感"
    if (kind === "ecology_memory_hint") return "生态照料"
    if (kind === "relationship_memory_hint") return "关系关注"

    return "世界提示"
  })
}

function buildButlerReasoningSummary(
  motivationLabel: string,
  memoryBiasLabel: string
): string {
  if (memoryBiasLabel === "安静") {
    return `管家正在选择“${motivationLabel}”。当前判断主要来自已保存的世界状态和资源情况。`
  }

  return `管家正在选择“${motivationLabel}”。已保存的痕迹正在形成${memoryBiasLabel}的记忆偏置，但它们仍然只是提示。`
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
      "当前还没有稳定记忆提示被使用。",
      "管家仍会优先遵守资源、世界状态和安全运行规则。",
      "这段说明只读取已保存世界，不会创建行动。",
    ]
  }

  return [
    `${input.memorySeedCount} 条痕迹记忆提示正在作为轻量偏置被读取，不是直接命令。`,
    input.focusLabels.length > 0
      ? `当前提示重点：${input.focusLabels.join("、")}。`
      : "当前提示保持宽泛，不强制指定行动。",
    input.regionLabels.length > 0
      ? `管家已经注意到这些熟悉区域：${input.regionLabels.join("、")}。`
      : "管家会把这些提示和正式世界事实分开处理。",
  ]
}
