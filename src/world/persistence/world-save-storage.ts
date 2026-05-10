/**
 * 当前文件负责：通过 localStorage 读写世界本地存档。
 */

import type {
  WorldSaveSnapshot,
  WorldSaveValidationResult,
} from "./world-save-schema"
import {
  normalizeWorldSaveSnapshot,
  validateWorldSaveSnapshot,
} from "./world-save-validator"

const WORLD_SAVE_STORAGE_KEY = "ai-pet-world.desktop-mvp.world-save.v1"

function canUseLocalStorage(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined"
  )
}

export function saveWorldSnapshot(
  snapshot: WorldSaveSnapshot
): WorldSaveValidationResult {
  const validation = validateWorldSaveSnapshot(snapshot)

  if (!validation.ok) return validation

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

export function loadWorldSnapshot(): WorldSaveSnapshot | null {
  if (!canUseLocalStorage()) return null

  try {
    const rawValue = window.localStorage.getItem(WORLD_SAVE_STORAGE_KEY)

    if (!rawValue) return null

    const parsedValue = JSON.parse(rawValue) as unknown
    const snapshot = normalizeWorldSaveSnapshot(parsedValue)

    if (!snapshot) {
      clearWorldSnapshot()
      return null
    }

    return snapshot
  } catch {
    clearWorldSnapshot()
    return null
  }
}

export function clearWorldSnapshot(): void {
  if (!canUseLocalStorage()) return

  window.localStorage.removeItem(WORLD_SAVE_STORAGE_KEY)
}

export function hasWorldSnapshot(): boolean {
  if (!canUseLocalStorage()) return false

  return window.localStorage.getItem(WORLD_SAVE_STORAGE_KEY) !== null
}

export function getWorldSaveStorageKey(): string {
  return WORLD_SAVE_STORAGE_KEY
}
