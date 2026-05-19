/**
 * 当前文件职责：提供 WorldLoop 持久化状态的 storage adapter。
 */

import type { RuntimeWorldState } from "./world-loop-schema"
import {
  buildPersistedWorldLoopState,
  validatePersistedWorldLoopState,
  type PersistedWorldLoopState,
  type PersistedWorldLoopStateValidationResult,
} from "./world-loop-persistence-schema"

export type WorldLoopPersistenceStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type BuildWorldLoopPersistenceKeyInput = {
  worldId: string
}

export type SavePersistedWorldLoopStateInput = {
  storage: WorldLoopPersistenceStorage
  runtimeState: RuntimeWorldState
  savedAt: number
}

export type SavePersistedWorldLoopStateResult = {
  ok: boolean
  key: string
  persistedState?: PersistedWorldLoopState
  message: string
  tags: string[]
}

export type LoadPersistedWorldLoopStateInput = {
  storage: WorldLoopPersistenceStorage
  worldId: string
  ownerId: string
}

export type LoadPersistedWorldLoopStateResult = {
  ok: boolean
  key: string
  persistedState?: PersistedWorldLoopState
  validation: PersistedWorldLoopStateValidationResult
  message: string
  tags: string[]
}

export type ClearPersistedWorldLoopStateInput = {
  storage: WorldLoopPersistenceStorage
  worldId: string
}

export type ClearPersistedWorldLoopStateResult = {
  ok: boolean
  key: string
  message: string
  tags: string[]
}

export function buildWorldLoopPersistenceKey(
  input: BuildWorldLoopPersistenceKeyInput
): string {
  return `ai-pet-world:world-loop:${input.worldId}`
}

export function savePersistedWorldLoopState(
  input: SavePersistedWorldLoopStateInput
): SavePersistedWorldLoopStateResult {
  const key = buildWorldLoopPersistenceKey({
    worldId: input.runtimeState.worldId,
  })
  const persistedState = buildPersistedWorldLoopState({
    runtimeState: input.runtimeState,
    savedAt: input.savedAt,
  })

  try {
    input.storage.setItem(key, JSON.stringify(persistedState))

    return {
      ok: true,
      key,
      persistedState,
      message: "WorldLoop 持久化保存成功。",
      tags: [
        "world_loop_persistence_adapter_v0",
        "save_success",
        `world:${input.runtimeState.worldId}`,
      ],
    }
  } catch {
    return {
      ok: false,
      key,
      message: "WorldLoop 持久化保存失败。",
      tags: [
        "world_loop_persistence_adapter_v0",
        "save_failed",
        `world:${input.runtimeState.worldId}`,
      ],
    }
  }
}

export function loadPersistedWorldLoopState(
  input: LoadPersistedWorldLoopStateInput
): LoadPersistedWorldLoopStateResult {
  const key = buildWorldLoopPersistenceKey({ worldId: input.worldId })
  const rawValue = input.storage.getItem(key)

  if (rawValue === null) {
    return {
      ok: false,
      key,
      validation: {
        isValid: false,
        reasons: ["未找到持久化 WorldLoop 状态。"],
        tags: ["persisted_world_loop_state_validation", "missing"],
      },
      message: "未找到持久化 WorldLoop 状态。",
      tags: [
        "world_loop_persistence_adapter_v0",
        "load_missing",
        `world:${input.worldId}`,
      ],
    }
  }

  try {
    const parsedValue: unknown = JSON.parse(rawValue)
    const persistedState = parsedValue as PersistedWorldLoopState
    const validation = validatePersistedWorldLoopState({
      persistedState,
      expectedWorldId: input.worldId,
      expectedOwnerId: input.ownerId,
    })

    if (!validation.isValid) {
      return {
        ok: false,
        key,
        persistedState,
        validation,
        message: "持久化 WorldLoop 状态校验失败。",
        tags: [
          "world_loop_persistence_adapter_v0",
          "load_invalid",
          `world:${input.worldId}`,
        ],
      }
    }

    return {
      ok: true,
      key,
      persistedState,
      validation,
      message: "WorldLoop 持久化状态加载成功。",
      tags: [
        "world_loop_persistence_adapter_v0",
        "load_success",
        `world:${input.worldId}`,
      ],
    }
  } catch {
    return {
      ok: false,
      key,
      validation: {
        isValid: false,
        reasons: ["持久化 WorldLoop 状态 JSON 解析失败。"],
        tags: ["persisted_world_loop_state_validation", "parse_failed"],
      },
      message: "持久化 WorldLoop 状态 JSON 解析失败。",
      tags: [
        "world_loop_persistence_adapter_v0",
        "load_parse_failed",
        `world:${input.worldId}`,
      ],
    }
  }
}

export function clearPersistedWorldLoopState(
  input: ClearPersistedWorldLoopStateInput
): ClearPersistedWorldLoopStateResult {
  const key = buildWorldLoopPersistenceKey({ worldId: input.worldId })

  try {
    input.storage.removeItem(key)

    return {
      ok: true,
      key,
      message: "WorldLoop 持久化状态已清除。",
      tags: [
        "world_loop_persistence_adapter_v0",
        "clear_success",
        `world:${input.worldId}`,
      ],
    }
  } catch {
    return {
      ok: false,
      key,
      message: "WorldLoop 持久化状态清除失败。",
      tags: [
        "world_loop_persistence_adapter_v0",
        "clear_failed",
        `world:${input.worldId}`,
      ],
    }
  }
}
