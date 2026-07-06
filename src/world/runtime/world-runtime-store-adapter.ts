/**
 * Runtime store adapter boundary.
 *
 * Formal runtime code depends on this protocol instead of a concrete storage
 * implementation. Local file storage remains the current development adapter.
 */

import type {
  WorldRuntimeSaveRecord,
  WorldRuntimeStoreAdapter,
  WorldRuntimeStoreReadResult,
  WorldRuntimeStoreWriteResult,
} from "./world-runtime-schema"
import { localFileRuntimeStore } from "./world-runtime-store"

export async function getWorldRuntimeStoreAdapter(): Promise<WorldRuntimeStoreAdapter> {
  if (process.env.NODE_ENV === "production") {
    return runtimeStoreNotConfiguredAdapter
  }

  return localFileRuntimeStore
}

export async function readWorldRuntimeSaveRecord(input?: {
  filePath?: string
}): Promise<WorldRuntimeStoreReadResult> {
  const adapter = await getWorldRuntimeStoreAdapter()
  return adapter.read(input)
}

export async function writeWorldRuntimeSaveRecord(input: {
  record: WorldRuntimeSaveRecord
  filePath?: string
}): Promise<WorldRuntimeStoreWriteResult> {
  const adapter = await getWorldRuntimeStoreAdapter()
  return adapter.write(input)
}

export async function getDefaultWorldRuntimeSavePath(): Promise<string> {
  const adapter = await getWorldRuntimeStoreAdapter()
  return adapter.getDefaultSavePath()
}

const runtimeStoreNotConfiguredAdapter: WorldRuntimeStoreAdapter = {
  kind: "database_runtime_store",
  getDefaultSavePath: () => "runtime-store:not-configured",
  read: async () => ({
    status: "failed",
    record: null,
    path: "runtime-store:not-configured",
    message: "Runtime store adapter is not configured for production.",
    warnings: ["Configure DatabaseRuntimeStore before enabling production persistence."],
    tags: [
      "world_runtime_store_read",
      "failed",
      "runtime_store_not_configured",
      "database_runtime_store_required",
    ],
  }),
  write: async () => ({
    ok: false,
    path: "runtime-store:not-configured",
    message: "Runtime store adapter is not configured for production.",
    warnings: ["Configure DatabaseRuntimeStore before enabling production persistence."],
    tags: [
      "world_runtime_store_write",
      "failed",
      "runtime_store_not_configured",
      "database_runtime_store_required",
    ],
  }),
}
