/**
 * 当前文件负责：提供稳定的世界 seed 生成函数。
 */

export type StableWorldSeedInput = {
  ownerId: string
  birthSignature: string
  worldSalt: string
}

export function buildStableWorldSeed(input: StableWorldSeedInput): string {
  const source = [
    normalizeSeedPart(input.ownerId),
    normalizeSeedPart(input.birthSignature),
    normalizeSeedPart(input.worldSalt),
  ].join("|")

  return `world_${hashText(source).toString(36)}`
}

export function buildSeededNumber(seed: string, salt: string): number {
  return hashText(`${seed}|${normalizeSeedPart(salt)}`) / 0xffffffff
}

export function pickSeededItem<T>(
  items: readonly T[],
  seed: string,
  salt: string
): T {
  if (items.length === 0) {
    throw new Error("pickSeededItem requires at least one item.")
  }

  const index = Math.floor(buildSeededNumber(seed, salt) * items.length)

  return items[Math.min(index, items.length - 1)]
}

function normalizeSeedPart(value: string): string {
  return value.trim().toLowerCase() || "unknown"
}

function hashText(value: string): number {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}
