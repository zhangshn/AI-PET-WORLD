/**
 * 当前文件负责：校验与归一化世界本地存档。
 */

import {
  WORLD_SAVE_VERSION,
  type WorldSaveSnapshot,
  type WorldSaveValidationResult,
} from "./world-save-schema"

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object"
}

function getSaveVersion(value: Record<string, unknown>): number | null {
  const version = value.version ?? value.saveVersion

  return typeof version === "number" ? version : null
}

function hasNestedRestoreShape(value: Record<string, unknown>): boolean {
  const engine = value.engine
  const systems = value.systems
  const world = value.world
  const aiData = value.aiData

  if (!isRecord(engine) || typeof engine.tick !== "number") return false
  if (!engine.time) return false
  if (!isRecord(systems)) return false
  if (!systems.butler || !systems.home) return false
  if (!isRecord(world) || !world.runtime || !world.progression) return false
  if (!isRecord(aiData) || !Array.isArray(aiData.records)) return false

  return true
}

export function validateWorldSaveSnapshot(
  value: unknown
): WorldSaveValidationResult {
  if (!isRecord(value)) {
    return {
      ok: false,
      reason: "存档不是有效对象。",
    }
  }

  const version = getSaveVersion(value)

  if (version !== WORLD_SAVE_VERSION) {
    return {
      ok: false,
      reason: "存档版本不匹配。",
    }
  }

  if (typeof value.savedAt !== "number") {
    return {
      ok: false,
      reason: "存档缺少保存时间。",
    }
  }

  if (!hasNestedRestoreShape(value)) {
    return {
      ok: false,
      reason: "存档缺少恢复所需的世界状态。",
    }
  }

  return {
    ok: true,
  }
}

export function normalizeWorldSaveSnapshot(
  value: unknown
): WorldSaveSnapshot | null {
  const validation = validateWorldSaveSnapshot(value)

  if (!validation.ok || !isRecord(value)) return null

  const snapshot = value as WorldSaveSnapshot

  return {
    ...snapshot,
    version: WORLD_SAVE_VERSION,
    saveVersion: WORLD_SAVE_VERSION,
    tick: snapshot.engine.tick,
    time: snapshot.engine.time,
    pet: snapshot.systems.pet,
    butler: snapshot.systems.butler,
    home: snapshot.systems.home,
    worldRuntime: snapshot.world.runtime,
    ecology: snapshot.world.runtime.ecology,
    lastPlayedAt: snapshot.lastPlayedAt ?? snapshot.savedAt,
    tags: snapshot.tags ?? snapshot.meta.tags ?? [],
    notes: snapshot.notes ?? snapshot.meta.notes,
    meta: {
      ...snapshot.meta,
      tags: snapshot.meta.tags ?? snapshot.tags ?? [],
      notes: snapshot.meta.notes ?? snapshot.notes,
    },
  }
}
