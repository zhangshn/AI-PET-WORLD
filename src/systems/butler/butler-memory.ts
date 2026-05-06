/**
 * 当前文件负责：定义与维护管家的长期记忆结构。
 */

import type { ButlerTask } from "./butler-schema"
import type {
  ButlerTaskDecisionTrace,
} from "./butler-task-decision-trace"

export type ButlerMemoryType =
  | "observation"
  | "care_opportunity"
  | "home_building"
  | "incubator_care"
  | "relation_signal"
  | "system_note"

export type ButlerMemoryEntry = {
  id: string
  tick: number
  lastUpdatedTick: number
  repeatCount: number
  type: ButlerMemoryType
  sourceTask: ButlerTask
  summary: string
  emotionalWeight: number
  importance: number
  tags: string[]
}

export type ButlerMemoryState = {
  entries: ButlerMemoryEntry[]
  latestEntry: ButlerMemoryEntry | null
  totalCount: number
  mergedCount: number
}

export function createInitialButlerMemoryState(): ButlerMemoryState {
  return {
    entries: [],
    latestEntry: null,
    totalCount: 0,
    mergedCount: 0,
  }
}

function clampMemoryValue(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.min(100, Math.round(value)))
}

function mapTaskToMemoryType(task: ButlerTask): ButlerMemoryType {
  if (task === "watching_incubator") return "incubator_care"
  if (task === "building_home") return "home_building"
  if (task.startsWith("offering_")) return "care_opportunity"
  if (task === "watching_pet") return "observation"

  return "system_note"
}

function buildTaskMemoryTags(trace: ButlerTaskDecisionTrace): string[] {
  return [
    `task_${trace.selectedTask}`,
    `previous_${trace.previousTask}`,
    `gates_${trace.gates.length}`,
    `scores_${trace.scores.length}`,
    trace.context.hasPet ? "has_pet" : "no_pet",
    trace.context.hasTimelineSnapshot ? "has_timeline" : "no_timeline",
    trace.context.incubatorCompleted
      ? "incubator_completed"
      : "incubator_running",
    trace.context.homeCompleted ? "home_completed" : "home_not_completed",
    trace.context.petLifePhase
      ? `life_phase_${trace.context.petLifePhase}`
      : "life_phase_none",
  ]
}

function buildTaskMemorySummary(trace: ButlerTaskDecisionTrace): string {
  if (trace.selectedTask === "watching_incubator") {
    return `管家记录：孵化器仍需要照看。本轮原因：${trace.reason}`
  }

  if (trace.selectedTask === "building_home") {
    return `管家记录：家园建设被推进。本轮原因：${trace.reason}`
  }

  if (trace.selectedTask === "watching_pet") {
    return `管家记录：管家选择观察宠物。本轮原因：${trace.reason}`
  }

  if (trace.selectedTask === "offering_food") {
    return `管家记录：管家准备提供食物机会。本轮原因：${trace.reason}`
  }

  if (trace.selectedTask === "offering_rest") {
    return `管家记录：管家准备提供休息机会。本轮原因：${trace.reason}`
  }

  if (trace.selectedTask === "offering_approach") {
    return `管家记录：管家准备提供靠近机会。本轮原因：${trace.reason}`
  }

  return `管家记录：本轮保持待命。本轮原因：${trace.reason}`
}

function deriveMemoryImportance(trace: ButlerTaskDecisionTrace): number {
  const baseByTask: Record<ButlerTask, number> = {
    watching_incubator: 58,
    building_home: 48,
    watching_pet: 36,
    offering_food: 68,
    offering_rest: 62,
    offering_approach: 64,
    idle: 20,
  }

  const base = baseByTask[trace.selectedTask]
  const gateBonus = Math.min(12, trace.gates.length * 2)
  const failedGateBonus = Math.min(
    10,
    trace.gates.filter((gate) => !gate.passed).length * 3
  )
  const opportunityBonus = trace.selectedTask.startsWith("offering_")
    ? 8
    : 0

  return clampMemoryValue(
    base + gateBonus + failedGateBonus + opportunityBonus
  )
}

function deriveMemoryEmotionalWeight(trace: ButlerTaskDecisionTrace): number {
  if (trace.selectedTask === "offering_food") return 55
  if (trace.selectedTask === "offering_rest") return 48
  if (trace.selectedTask === "offering_approach") return 60
  if (trace.selectedTask === "watching_pet") return 28
  if (trace.selectedTask === "watching_incubator") return 34

  return 22
}

function uniqueTags(tags: string[]): string[] {
  return Array.from(new Set(tags))
}

function shouldMergeWithLatestMemory(input: {
  latest: ButlerMemoryEntry | null
  entry: ButlerMemoryEntry
  maxTickGap?: number
}): boolean {
  if (!input.latest) return false

  const maxTickGap = input.maxTickGap ?? 6
  const tickGap = input.entry.tick - input.latest.lastUpdatedTick

  if (tickGap < 0 || tickGap > maxTickGap) return false
  if (input.latest.type !== input.entry.type) return false
  if (input.latest.sourceTask !== input.entry.sourceTask) return false

  const latestLifePhase = input.latest.tags.find((tag) =>
    tag.startsWith("life_phase_")
  )
  const nextLifePhase = input.entry.tags.find((tag) =>
    tag.startsWith("life_phase_")
  )

  if (latestLifePhase !== nextLifePhase) return false

  const latestHomeState = input.latest.tags.includes("home_completed")
    ? "home_completed"
    : "home_not_completed"
  const nextHomeState = input.entry.tags.includes("home_completed")
    ? "home_completed"
    : "home_not_completed"

  return latestHomeState === nextHomeState
}

function mergeMemoryEntry(input: {
  latest: ButlerMemoryEntry
  entry: ButlerMemoryEntry
}): ButlerMemoryEntry {
  const repeatCount = input.latest.repeatCount + 1

  return {
    ...input.latest,
    lastUpdatedTick: input.entry.tick,
    repeatCount,
    importance: clampMemoryValue(
      Math.max(input.latest.importance, input.entry.importance) +
        Math.min(10, repeatCount)
    ),
    emotionalWeight: clampMemoryValue(
      Math.max(input.latest.emotionalWeight, input.entry.emotionalWeight)
    ),
    tags: uniqueTags([
      ...input.latest.tags,
      ...input.entry.tags,
      `repeat_${repeatCount}`,
    ]),
    summary:
      repeatCount <= 1
        ? input.latest.summary
        : `${input.latest.summary}（连续出现 ${repeatCount} 次，最近一次在 Tick ${input.entry.tick}。）`,
  }
}

export function createButlerMemoryEntry(input: {
  tick: number
  type: ButlerMemoryType
  sourceTask: ButlerTask
  summary: string
  emotionalWeight?: number
  importance?: number
  tags?: string[]
}): ButlerMemoryEntry {
  return {
    id: `butler-memory-${input.tick}-${input.type}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    tick: input.tick,
    lastUpdatedTick: input.tick,
    repeatCount: 1,
    type: input.type,
    sourceTask: input.sourceTask,
    summary: input.summary,
    emotionalWeight: input.emotionalWeight ?? 0,
    importance: input.importance ?? 1,
    tags: input.tags ?? [],
  }
}

export function createButlerMemoryEntryFromTaskDecision(input: {
  tick: number
  trace: ButlerTaskDecisionTrace
}): ButlerMemoryEntry {
  const type = mapTaskToMemoryType(input.trace.selectedTask)

  return createButlerMemoryEntry({
    tick: input.tick,
    type,
    sourceTask: input.trace.selectedTask,
    summary: buildTaskMemorySummary(input.trace),
    emotionalWeight: deriveMemoryEmotionalWeight(input.trace),
    importance: deriveMemoryImportance(input.trace),
    tags: buildTaskMemoryTags(input.trace),
  })
}

export function appendButlerMemoryEntry(input: {
  memory: ButlerMemoryState
  entry: ButlerMemoryEntry
  maxEntries?: number
}): ButlerMemoryState {
  const maxEntries = input.maxEntries ?? 50
  const latest = input.memory.latestEntry

  if (
    shouldMergeWithLatestMemory({
      latest,
      entry: input.entry,
    }) &&
    latest
  ) {
    const mergedLatest = mergeMemoryEntry({
      latest,
      entry: input.entry,
    })

    const entries = [
      mergedLatest,
      ...input.memory.entries.slice(1),
    ].slice(0, maxEntries)

    return {
      entries,
      latestEntry: mergedLatest,
      totalCount: input.memory.totalCount + 1,
      mergedCount: input.memory.mergedCount + 1,
    }
  }

  const entries = [
    input.entry,
    ...input.memory.entries,
  ].slice(0, maxEntries)

  return {
    entries,
    latestEntry: input.entry,
    totalCount: input.memory.totalCount + 1,
    mergedCount: input.memory.mergedCount,
  }
}

export function shouldRememberTaskDecision(input: {
  memory: ButlerMemoryState
  trace: ButlerTaskDecisionTrace | null | undefined
}): boolean {
  if (!input.trace) return false

  const latest = input.memory.latestEntry

  if (!latest) return true

  if (
    shouldMergeWithLatestMemory({
      latest,
      entry: createButlerMemoryEntryFromTaskDecision({
        tick: latest.lastUpdatedTick + 1,
        trace: input.trace,
      }),
    })
  ) {
    return true
  }

  return latest.sourceTask !== input.trace.selectedTask
}