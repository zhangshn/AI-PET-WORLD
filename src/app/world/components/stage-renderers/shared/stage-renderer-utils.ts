/**
 * 当前文件负责：提供世界舞台渲染器共享的工具函数。
 */

export function lightenColor(color: number, amount: number): number {
  const r = (color >> 16) & 255
  const g = (color >> 8) & 255
  const b = color & 255

  const nextR = clampNumber(r + amount, 0, 255)
  const nextG = clampNumber(g + amount, 0, 255)
  const nextB = clampNumber(b + amount, 0, 255)

  return (nextR << 16) + (nextG << 8) + nextB
}

export function darkenColor(color: number, amount: number): number {
  const r = (color >> 16) & 255
  const g = (color >> 8) & 255
  const b = color & 255

  const nextR = clampNumber(r - amount, 0, 255)
  const nextG = clampNumber(g - amount, 0, 255)
  const nextB = clampNumber(b - amount, 0, 255)

  return (nextR << 16) + (nextG << 8) + nextB
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function createStringSeed(value: string): number {
  let seed = 0

  for (let index = 0; index < value.length; index += 1) {
    seed += value.charCodeAt(index) * (index + 7)
  }

  return Math.abs(seed)
}

export function createPointSeed(x: number, y: number): number {
  const value = Math.sin(x * 127.1 + y * 311.7) * 10000

  return Math.abs(Math.floor(value))
}

export function createMixedSeed(parts: Array<string | number>): number {
  let seed = 0

  for (const [index, part] of parts.entries()) {
    if (typeof part === "number") {
      seed += Math.round(part * (index + 11))
      continue
    }

    seed += createStringSeed(part) * (index + 3)
  }

  return Math.abs(seed)
}