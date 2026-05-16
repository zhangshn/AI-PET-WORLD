/**
 * 当前文件负责：提供 Canvas 渲染使用的稳定像素偏移。
 */

function hashString32(input: string): number {
  let hash = 0x811c9dc5

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return hash >>> 0
}

function stableSignedInt(input: string, amplitude: number): number {
  const span = amplitude * 2 + 1

  return (hashString32(input) % span) - amplitude
}

export function buildStableCanvasOffset(
  seedBase: string,
  placementId: string
): { dx: number; dy: number } {
  return {
    dx: stableSignedInt(`${seedBase}:${placementId}:dx`, 5),
    dy: stableSignedInt(`${seedBase}:${placementId}:dy`, 4),
  }
}
