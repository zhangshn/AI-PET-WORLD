/**
 * 当前文件负责：生成稳定的世界 seed。
 */

import type { StableWorldSeed, WorldSeedInput } from "./generation-schema"

export function createStableWorldSeed(input: WorldSeedInput): StableWorldSeed {
  const sourceText = [
    normalizeSeedPart(input.ownerId),
    normalizeSeedPart(input.birthSignature),
    normalizeSeedPart(input.worldSalt),
  ].join("|")

  const numericHash = hashSeedText(sourceText)

  return {
    value: `world_${numericHash.toString(36)}`,
    numericHash,
    sourceText,
  }
}

function normalizeSeedPart(value: string): string {
  return value.trim().toLowerCase() || "unknown"
}

function hashSeedText(value: string): number {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}
