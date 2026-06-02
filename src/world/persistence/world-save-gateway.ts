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
  clearWorldSnapshot as clearWorldSnapshotFromLocal,
  getWorldSaveStorageKey,
  hasWorldSnapshot,
  loadWorldSnapshot,
  loadWorldSnapshot as loadWorldSnapshotFromLocal,
  saveWorldSnapshot,
  saveWorldSnapshot as saveWorldSnapshotToLocal,
} from "./world-save-storage"

export {
  normalizeWorldSaveSnapshot,
  validateWorldSaveSnapshot,
} from "./world-save-validator"
