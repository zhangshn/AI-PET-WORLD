/**
 * 当前文件负责：通过 localStorage 保存、读取和清除世界本地存档。
 */

import {
  WORLD_SAVE_VERSION,
  type WorldSaveSnapshot,
  type WorldSaveValidationResult,
} from "./world-save-types"

const WORLD_SAVE_STORAGE_KEY = "ai-pet-world.desktop-mvp.world-save.v1"

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

export function validateWorldSaveSnapshot(
  value: unknown
): WorldSaveValidationResult {
  if (!value || typeof value !== "object") {
    return {
      ok: false,
      reason: "存档不是有效对象。",
    }
  }

  const snapshot = value as Partial<WorldSaveSnapshot>

  if (snapshot.saveVersion !== WORLD_SAVE_VERSION) {
    return {
      ok: false,
      reason: "存档版本不匹配。",
    }
  }

  if (!snapshot.engine || typeof snapshot.engine.tick !== "number") {
    return {
      ok: false,
      reason: "存档缺少引擎状态。",
    }
  }

  if (!snapshot.engine.time) {
    return {
      ok: false,
      reason: "存档缺少世界时间。",
    }
  }

  if (!snapshot.systems) {
    return {
      ok: false,
      reason: "存档缺少系统状态。",
    }
  }

  if (!snapshot.world) {
    return {
      ok: false,
      reason: "存档缺少世界运行状态。",
    }
  }

  if (!snapshot.aiData || !Array.isArray(snapshot.aiData.records)) {
    return {
      ok: false,
      reason: "存档缺少 AI 数据。",
    }
  }

  return {
    ok: true,
  }
}

export function saveWorldSnapshotToLocal(
  snapshot: WorldSaveSnapshot
): WorldSaveValidationResult {
  if (!canUseLocalStorage()) {
    return {
      ok: false,
      reason: "当前环境不可使用 localStorage。",
    }
  }

  try {
    window.localStorage.setItem(
      WORLD_SAVE_STORAGE_KEY,
      JSON.stringify(snapshot)
    )

    return {
      ok: true,
    }
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof Error
          ? error.message
          : "写入 localStorage 时发生未知错误。",
    }
  }
}

export function loadWorldSnapshotFromLocal(): WorldSaveSnapshot | null {
  if (!canUseLocalStorage()) {
    return null
  }

  try {
    const rawValue = window.localStorage.getItem(WORLD_SAVE_STORAGE_KEY)

    if (!rawValue) {
      return null
    }

    const parsedValue = JSON.parse(rawValue) as unknown
    const validation = validateWorldSaveSnapshot(parsedValue)

    if (!validation.ok) {
      return null
    }

    return parsedValue as WorldSaveSnapshot
  } catch {
    return null
  }
}

export function clearWorldSnapshotFromLocal(): void {
  if (!canUseLocalStorage()) {
    return
  }

  window.localStorage.removeItem(WORLD_SAVE_STORAGE_KEY)
}

export function getWorldSaveStorageKey(): string {
  return WORLD_SAVE_STORAGE_KEY
}