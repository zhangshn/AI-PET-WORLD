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
  NaturalWorldRuntimeReadInput,
  NaturalWorldRuntimeReadResult,
  NaturalWorldRuntimeWriteInput,
  NaturalWorldRuntimeWriteResult,
} from "./world-runtime-schema"
import { localFileRuntimeStore } from "./world-runtime-store"
import { createProductionWorldRuntimeStore } from "./world-runtime-production-store"
import { assertNaturalWorldReadInput, snapshotNaturalWorldWrite } from "./world-runtime-record-validation"

export async function getWorldRuntimeStoreAdapter(): Promise<WorldRuntimeStoreAdapter> {
  if (process.env.NODE_ENV === "production") {
    const configuredRoot = process.env.AI_PET_WORLD_RUNTIME_STORE_ROOT?.trim()
    if (!configuredRoot) {
      throw new Error(
        "AI_PET_WORLD_RUNTIME_STORE_ROOT is required before starting the production Runtime Store",
      )
    }
    return createProductionWorldRuntimeStore(configuredRoot)
  }

  return localFileRuntimeStore
}

export async function readWorldRuntimeSaveRecord(input?: {
  filePath?: string
  ownerId?: string
  worldId?: string
}): Promise<WorldRuntimeStoreReadResult> {
  const adapter = await getWorldRuntimeStoreAdapter()
  return adapter.read(input)
}

export async function writeWorldRuntimeSaveRecord(input: {
  record: WorldRuntimeSaveRecord
  filePath?: string
  expectedTick?: number
}): Promise<WorldRuntimeStoreWriteResult> {
  const adapter = await getWorldRuntimeStoreAdapter()
  return adapter.write(input)
}

export async function getDefaultWorldRuntimeSavePath(): Promise<string> {
  const adapter = await getWorldRuntimeStoreAdapter()
  return adapter.getDefaultSavePath()
}

export async function readNaturalWorldRuntimeSaveRecord(input: NaturalWorldRuntimeReadInput): Promise<NaturalWorldRuntimeReadResult> {
  assertNaturalWorldReadInput(input)
  const fixed = structuredClone(input)
  const adapter = await getWorldRuntimeStoreAdapter()
  if (!adapter.readNatural) throw new Error("natural_world_store_capability_unavailable")
  return adapter.readNatural(fixed)
}

export async function writeNaturalWorldRuntimeSaveRecord(input: NaturalWorldRuntimeWriteInput): Promise<NaturalWorldRuntimeWriteResult> {
  const fixed = snapshotNaturalWorldWrite(input)
  const adapter = await getWorldRuntimeStoreAdapter()
  if (!adapter.writeNatural) throw new Error("natural_world_store_capability_unavailable")
  // Concrete file adapters snapshot synchronously before their first await.
  return adapter.writeNatural(fixed)
}
