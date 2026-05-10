/**
 * 当前文件负责：兼容旧的世界本地存档存储入口。
 */

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
