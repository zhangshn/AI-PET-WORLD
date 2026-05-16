/**
 * 当前文件负责：生成稳定的地表点缀偏移。
 */

export function getStableDecalOffset(
  seedKey: string,
  maxX = 5,
  maxY = 4
): { dx: number; dy: number } {
  return {
    dx: getStableRangeValue(`${seedKey}:x`, -maxX, maxX),
    dy: getStableRangeValue(`${seedKey}:y`, -maxY, maxY),
  }
}

function getStableRangeValue(seed: string, min: number, max: number): number {
  const range = max - min + 1

  return min + (hashString(seed) % range)
}

function hashString(value: string): number {
  return Array.from(value).reduce((hash, char) => {
    return (hash * 31 + char.charCodeAt(0)) >>> 0
  }, 2166136261)
}
