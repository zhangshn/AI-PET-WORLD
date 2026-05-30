// 该文件用于生成正式像素世界中的树木绘制片段。

import type { FormalPixelObjectRenderItem } from "./formal-pixel-renderer-schema"

type TreeBlock = {
  x: number
  y: number
  w: number
  h: number
  color: string
  opacity?: number
}

type TreePalette = {
  ground: string
  groundDark: string
  trunkDark: string
  trunk: string
  trunkLight: string
  branch: string
  leafBack: string
  leafDark: string
  leaf: string
  leafLight: string
  leafUnder: string
  grass: string
  grassLight: string
}

type LeafMass = {
  cx: number
  cy: number
  rows: number[]
  color: string
  sx: number
  sy: number
  jitter: number
}

const ROWS = {
  wide: [4, 9, 15, 21, 27, 32, 34, 33, 29, 23, 16, 9, 4],
  main: [3, 8, 14, 20, 25, 28, 27, 23, 17, 10, 4],
  small: [2, 5, 9, 13, 15, 13, 8, 4],
  under: [5, 12, 20, 26, 24, 18, 9],
}

export function renderFormalTreeObject(object: FormalPixelObjectRenderItem): string {
  const random = seededRandom(`${object.id}:${object.growthStage}:${object.health}:formal-tree-v1`)
  const palette = paletteFor(object.health)
  const baseX = Math.round(object.x)
  const baseY = Math.round(object.y)
  const scale = clamp(object.scale, 0.62, 1.85)
  const maturity = maturityFactor(object.growthStage)
  const healthFactor = clamp(object.health / 100, 0.28, 1)
  const trunkHeight = Math.round((22 + 16 * maturity) * scale)
  const trunkWidth = Math.max(5, Math.round((6 + 5 * maturity) * scale))
  const crownScale = clamp((0.72 + maturity * 0.58) * scale, 0.68, 1.75)
  const crownSpread = 0.92 + random() * 0.2
  const crownCy = baseY - trunkHeight - Math.round(12 * crownScale)
  const crownBlocks = buildCrownBlocks({
    baseX,
    crownCy,
    crownScale,
    crownSpread,
    healthFactor,
    palette,
    random,
  })

  return [
    `<g data-id="${escapeText(object.id)}" data-object-kind="tree" data-formal-recipe="formal_tree_recipe_v1" opacity="${object.opacity}">`,
    renderTreeGround(baseX, baseY, crownScale, palette, random),
    renderBranches(baseX, baseY, trunkHeight, crownScale, palette, random),
    renderTrunk(baseX, baseY, trunkWidth, trunkHeight, palette),
    renderBlocks(crownBlocks),
    renderFrontGrass(baseX, baseY, trunkWidth, scale, palette, random),
    `</g>`,
  ].join("\n")
}

function buildCrownBlocks(input: {
  baseX: number
  crownCy: number
  crownScale: number
  crownSpread: number
  healthFactor: number
  palette: TreePalette
  random: () => number
}): TreeBlock[] {
  const sx = input.crownScale * input.crownSpread
  const sy = input.crownScale
  const dense = clamp(0.68 + input.healthFactor * 0.42, 0.62, 1.08)
  const blocks: TreeBlock[] = []

  blocks.push(...stampLeafMass({ cx: input.baseX + Math.round(7 * sx), cy: input.crownCy, rows: ROWS.wide, color: input.palette.leafBack, sx: sx * 0.92 * dense, sy: sy * 0.92 * dense, jitter: 2 }, input.random))
  blocks.push(...stampLeafMass({ cx: input.baseX - Math.round(2 * sx), cy: input.crownCy + Math.round(1 * sy), rows: ROWS.main, color: input.palette.leaf, sx: sx * 1.05 * dense, sy: sy * dense, jitter: 1 }, input.random))
  blocks.push(...stampLeafMass({ cx: input.baseX + Math.round(17 * sx), cy: input.crownCy + Math.round(3 * sy), rows: ROWS.main, color: input.palette.leafDark, sx: sx * 0.78 * dense, sy: sy * 0.88 * dense, jitter: 2 }, input.random))
  blocks.push(...stampLeafMass({ cx: input.baseX - Math.round(11 * sx), cy: input.crownCy - Math.round(7 * sy), rows: ROWS.small, color: input.palette.leafLight, sx: sx * 0.82 * dense, sy: sy * 0.82 * dense, jitter: 1 }, input.random))
  blocks.push(...stampLeafMass({ cx: input.baseX + Math.round(1 * sx), cy: input.crownCy + Math.round(9 * sy), rows: ROWS.under, color: input.palette.leafUnder, sx: sx * 0.92 * dense, sy: sy * 0.78 * dense, jitter: 1 }, input.random))
  addLeafAccents(blocks, input.baseX, input.crownCy, sx, sy, input.palette, input.random)

  return blocks
}

function stampLeafMass(mass: LeafMass, random: () => number): TreeBlock[] {
  const rowStep = Math.max(2, Math.round(mass.sy * 4))
  const topY = Math.round(mass.cy - (mass.rows.length * rowStep) / 2)

  return mass.rows.flatMap((baseWidth, rowIndex) => {
    const width = Math.max(3, Math.round(baseWidth * mass.sx))
    const y = topY + rowIndex * rowStep
    const x = Math.round(mass.cx - width / 2 + Math.round((random() - 0.5) * mass.jitter * 4))
    const blocks: TreeBlock[] = [{ x, y, w: width, h: rowStep, color: mass.color }]

    if (random() > 0.72 && width > 12) {
      const side = random() > 0.5 ? -1 : 1
      blocks.push({
        x: side < 0 ? x - 3 : x + width,
        y: y + Math.round(random() * Math.max(1, rowStep - 1)),
        w: random() > 0.55 ? 3 : 2,
        h: 2,
        color: mass.color,
      })
    }

    return blocks
  })
}

function addLeafAccents(blocks: TreeBlock[], cx: number, cy: number, sx: number, sy: number, palette: TreePalette, random: () => number): void {
  const count = 10 + Math.round(random() * 12)

  for (let index = 0; index < count; index += 1) {
    const light = random() > 0.44
    const x = cx + Math.round((light ? -20 + random() * 22 : -4 + random() * 36) * sx)
    const y = cy + Math.round((light ? -13 + random() * 18 : -4 + random() * 23) * sy)
    const color = light ? palette.leafLight : random() > 0.48 ? palette.leafDark : palette.leafUnder
    const template = random() > 0.55 ? [[0, 0], [2, 0], [0, 2]] : [[0, 0], [2, 0], [4, 0], [2, 2]]

    template.forEach(([dx, dy]) => blocks.push({ x: x + dx, y: y + dy, w: 2, h: 2, color }))
  }
}

function renderTreeGround(baseX: number, baseY: number, crownScale: number, palette: TreePalette, random: () => number): string {
  const grassBlocks = Array.from({ length: 12 }, () => {
    const x = baseX + Math.round((random() - 0.5) * 58 * crownScale)
    const y = baseY + Math.round(random() * 7)
    return rect(x, y, 2, 2, random() > 0.5 ? palette.grassLight : palette.grass, 0.78)
  })

  return [
    `<ellipse cx="${baseX}" cy="${baseY + 6}" rx="${Math.round(36 * crownScale)}" ry="12" fill="${palette.ground}" opacity="0.44"/>`,
    `<ellipse cx="${baseX + 2}" cy="${baseY + 2}" rx="${Math.round(26 * crownScale)}" ry="8" fill="${palette.groundDark}" opacity="0.34"/>`,
    ...grassBlocks,
  ].join("\n")
}

function renderBranches(baseX: number, baseY: number, trunkHeight: number, crownScale: number, palette: TreePalette, random: () => number): string {
  return Array.from({ length: 4 }, (_, index) => {
    const side = index % 2 === 0 ? -1 : 1
    const startY = baseY - trunkHeight + 8 + index * 5
    const endX = baseX + side * Math.round((10 + random() * 14) * crownScale)
    const endY = startY - Math.round(4 + random() * 7)
    return `<line x1="${baseX}" y1="${startY}" x2="${endX}" y2="${endY}" stroke="${palette.branch}" stroke-width="3" stroke-linecap="square" opacity="0.38"/>`
  }).join("\n")
}

function renderTrunk(baseX: number, baseY: number, trunkWidth: number, trunkHeight: number, palette: TreePalette): string {
  const x = baseX - Math.round(trunkWidth / 2)
  const y = baseY - trunkHeight
  const lightWidth = Math.max(1, Math.round(trunkWidth * 0.2))

  return [
    rect(x, y, trunkWidth, trunkHeight, palette.trunkDark),
    rect(x + 1, y + 1, Math.max(1, trunkWidth - 2), Math.max(1, trunkHeight - 2), palette.trunk),
    rect(x + trunkWidth - lightWidth - 1, y + 5, lightWidth, Math.max(4, Math.round(trunkHeight * 0.52)), palette.trunkLight, 0.9),
    rect(x - 1, baseY - 3, 2, 3, palette.trunkDark, 0.78),
    rect(x + trunkWidth - 1, baseY - 3, 2, 3, palette.trunkDark, 0.78),
  ].join("\n")
}

function renderFrontGrass(baseX: number, baseY: number, trunkWidth: number, scale: number, palette: TreePalette, random: () => number): string {
  const count = Math.max(6, Math.round(12 * scale))

  return Array.from({ length: count }, () => {
    const height = Math.round(4 + random() * 9)
    const x = baseX + Math.round((random() - 0.5) * Math.max(18, trunkWidth * 8))
    const y = baseY + Math.round((random() - 0.2) * 7) - height
    return rect(x, y, 2, height, random() > 0.62 ? palette.grassLight : palette.grass)
  }).join("\n")
}

function renderBlocks(blocks: TreeBlock[]): string {
  return blocks.map((block) => rect(block.x, block.y, block.w, block.h, block.color, block.opacity)).join("\n")
}

function rect(x: number, y: number, w: number, h: number, color: string, opacity = 1): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}" opacity="${opacity}"/>`
}

function paletteFor(health: number): TreePalette {
  if (health < 38) {
    return { ground: "#243325", groundDark: "#1c2117", trunkDark: "#56381f", trunk: "#87623a", trunkLight: "#b4894d", branch: "#654527", leafBack: "#515b32", leafDark: "#3d4f2c", leaf: "#74834b", leafLight: "#aaa45f", leafUnder: "#2f3d25", grass: "#747a43", grassLight: "#9ea05a" }
  }

  if (health < 78) {
    return { ground: "#253b2b", groundDark: "#192519", trunkDark: "#5c3b21", trunk: "#8d6236", trunkLight: "#b98646", branch: "#684527", leafBack: "#365331", leafDark: "#284b2a", leaf: "#608c45", leafLight: "#a5b963", leafUnder: "#203b24", grass: "#657d3d", grassLight: "#96ae5c" }
  }

  return { ground: "#263f2f", groundDark: "#142319", trunkDark: "#5a351f", trunk: "#8a5a31", trunkLight: "#b87a3a", branch: "#6b4527", leafBack: "#1f5130", leafDark: "#154526", leaf: "#3f873d", leafLight: "#7ec35c", leafUnder: "#10351e", grass: "#3f7d3c", grassLight: "#7ab85c" }
}

function maturityFactor(growthStage: string): number {
  const stage = growthStage.toLowerCase()
  if (stage.includes("seed") || stage.includes("sprout")) return 0.22
  if (stage.includes("sapling")) return 0.38
  if (stage.includes("young")) return 0.58
  if (stage.includes("growing")) return 0.82
  if (stage.includes("mature") || stage.includes("adult")) return 1
  return 0.74
}

function seededRandom(seed: string): () => number {
  let state = hash(seed)
  return () => {
    state += 0x6d2b79f5
    let mixed = state
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

function hash(value: string): number {
  let current = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    current ^= value.charCodeAt(index)
    current = Math.imul(current, 16777619)
  }
  return current >>> 0
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function escapeText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}
