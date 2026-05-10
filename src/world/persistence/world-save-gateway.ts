/**
 * 当前文件负责：统一导出世界本地存档模块入口。
 */

export {
  WORLD_SAVE_VERSION,
  type WorldSaveMetadata,
  type WorldSaveSnapshot,
  type WorldSaveSource,
  type WorldSaveValidationResult,
} from "./world-save-schema"

export {
  clearWorldSnapshot,
  clearWorldSnapshotFromLocal,
  getWorldSaveStorageKey,
  hasWorldSnapshot,
  loadWorldSnapshotFromLocal,
  loadWorldSnapshot,
  normalizeWorldSaveSnapshot,
  saveWorldSnapshot,
  saveWorldSnapshotToLocal,
  validateWorldSaveSnapshot,
} from "./world-save-store"
