/**
 * ======================================================
 * AI-PET-WORLD
 * Memory Core Gateway
 * ======================================================
 *
 * 当前文件负责：
 * 1. 作为 memory-core 模块统一出口
 * 2. 对外暴露记忆初始化与更新方法
 * ======================================================
 */

import { buildInitialPetMemoryState } from "./memory-builder"
import { updatePetMemoryState } from "./memory-updater"

export {
  buildInitialPetMemoryState,
  updatePetMemoryState,
}

export type {
  MemoryActionRecord,
  MemoryEventKind,
  MemoryEventRecord,
  MemoryPreferenceBias,
  MemoryRelationImpression,
  MemorySelfImpression,
  MemoryWorldImpression,
  PetMemoryState,
  UpdateMemoryInput,
} from "./memory-types"