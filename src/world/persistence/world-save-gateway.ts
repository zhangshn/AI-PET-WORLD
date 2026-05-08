/**
 * 当前文件负责：统一导出世界本地存档模块入口。
 */

export {
  WORLD_SAVE_VERSION,
  type WorldSaveSnapshot,
  type WorldSaveSource,
  type WorldSaveValidationResult,
} from "./world-save-types"

export {
  clearWorldSnapshotFromLocal,
  getWorldSaveStorageKey,
  loadWorldSnapshotFromLocal,
  saveWorldSnapshotToLocal,
  validateWorldSaveSnapshot,
} from "./world-save-store"