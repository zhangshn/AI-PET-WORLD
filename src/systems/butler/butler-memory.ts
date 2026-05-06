/**
 * 当前文件负责：定义与维护管家的长期记忆结构。
 */

import type { ButlerTask } from "./butler-schema"

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
}

export function createInitialButlerMemoryState(): ButlerMemoryState {
  return {
    entries: [],
    latestEntry: null,
    totalCount: 0,
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
    type: input.type,
    sourceTask: input.sourceTask,
    summary: input.summary,
    emotionalWeight: input.emotionalWeight ?? 0,
    importance: input.importance ?? 1,
    tags: input.tags ?? [],
  }
}

export function appendButlerMemoryEntry(input: {
  memory: ButlerMemoryState
  entry: ButlerMemoryEntry
  maxEntries?: number
}): ButlerMemoryState {
  const maxEntries = input.maxEntries ?? 50
  const entries = [
    input.entry,
    ...input.memory.entries,
  ].slice(0, maxEntries)

  return {
    entries,
    latestEntry: input.entry,
    totalCount: input.memory.totalCount + 1,
  }
}