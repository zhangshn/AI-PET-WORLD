// 该文件用于生成正式像素世界中的地面绘制片段。

import type { FormalPixelTileRenderItem } from "./formal-pixel-renderer-schema"

type GroundPalette = {
  base: string
  dark: string
  light: string
  accent: string
  soil: string
}

export function renderFormalGroundTile(tile: FormalPixelTileRenderItem): string {
  const random = seededRandom(`${tile.id}:${tile.kind}:${tile.variant}:${tile.traceIntensity}:formal-ground-v1`)
  const palette = paletteFor(tile)
  const detailCount = detailCountFor(tile)
  const details = Array.from({ length: detailCount }, () => renderGroundDetail(tile, palette, random)).join("\n")
  const traceDetails = tile.traceIntensity > 0 ? renderTraceTint(tile, palette, random) : ""
  const edge = tile.kind === "boundary" ? renderBoundaryEdge(tile, palette) : ""

  return [
    `<g data-id="${escapeText(tile.id)}" data-tile-kind="${tile.kind}" data-formal-recipe="formal_ground_recipe_v1">`,
    `<rect x="${tile.x}" y="${tile.y}" width="${tile.width}" height="${tile.height}" fill="${palette.base}" opacity="${tile.passable ? 1 : 0.94}"/>`,
    details,
    traceDetails,
    edge,
    `</g>`,
  ].filter(Boolean).join("\n")
}

function renderGroundDetail(tile: FormalPixelTileRenderItem, palette: GroundPalette, random: () => number): string {
  const unit = Math.max(2, Math.round(tile.width / 8))
  const x = tile.x + Math.round(random() * Math.max(1, tile.width - unit))
  const y = tile.y + Math.round(random() * Math.max(1, tile.height - unit))
  const wide = random() > 0.74
  const color = pickDetailColor(tile, palette, random)
  const opacity = tile.kind === "boundary" ? 0.24 : 0.42 + random() * 0.28

  if (tile.kind === "grass" || tile.kind === "recovery_growth" || tile.kind === "ecology_transition") {
    return `<rect x="${x}" y="${y}" width="${wide ? unit * 2 : unit}" height="${unit}" fill="${color}" opacity="${opacity}"/>`
  }

  if (tile.kind === "pressed_grass" || tile.kind === "worn_grass") {
    return `<rect x="${x}" y="${y}" width="${wide ? unit * 3 : unit * 2}" height="${Math.max(1, Math.round(unit / 2))}" fill="${color}" opacity="${opacity}"/>`
  }

  if (tile.kind === "exposed_soil" || tile.kind === "soil") {
    return `<rect x="${x}" y="${y}" width="${wide ? unit * 2 : unit}" height="${wide ? unit : Math.max(1, Math.round(unit / 2))}" fill="${color}" opacity="${opacity}"/>`
  }

  return `<rect x="${x}" y="${y}" width="${unit}" height="${unit}" fill="${color}" opacity="${opacity}"/>`
}

function renderTraceTint(tile: FormalPixelTileRenderItem, palette: GroundPalette, random: () => number): string {
  const strength = clamp(tile.traceIntensity / 100, 0, 1)
  const width = Math.max(3, Math.round(tile.width * (0.28 + strength * 0.36)))
  const height = Math.max(2, Math.round(tile.height * (0.08 + strength * 0.14)))
  const x = tile.x + Math.round((tile.width - width) * (0.25 + random() * 0.5))
  const y = tile.y + Math.round((tile.height - height) * (0.35 + random() * 0.3))
  const color = tile.kind === "exposed_soil" ? palette.dark : palette.soil

  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${color}" opacity="${0.18 + strength * 0.28}"/>`
}

function renderBoundaryEdge(tile: FormalPixelTileRenderItem, palette: GroundPalette): string {
  return [
    `<rect x="${tile.x}" y="${tile.y}" width="${tile.width}" height="2" fill="${palette.light}" opacity="0.18"/>`,
    `<rect x="${tile.x}" y="${tile.y + tile.height - 2}" width="${tile.width}" height="2" fill="${palette.dark}" opacity="0.48"/>`,
  ].join("\n")
}

function detailCountFor(tile: FormalPixelTileRenderItem): number {
  if (tile.kind === "boundary") return 1
  if (tile.kind === "built") return 2
  if (tile.kind === "exposed_soil" || tile.kind === "soil") return 3
  if (tile.kind === "pressed_grass" || tile.kind === "worn_grass") return 3
  if (tile.kind === "ecology_transition" || tile.kind === "recovery_growth") return 4
  return 3
}

function pickDetailColor(tile: FormalPixelTileRenderItem, palette: GroundPalette, random: () => number): string {
  if (tile.kind === "exposed_soil" || tile.kind === "soil") {
    return random() > 0.62 ? palette.light : random() > 0.32 ? palette.dark : palette.accent
  }

  if (tile.kind === "pressed_grass" || tile.kind === "worn_grass") {
    return random() > 0.55 ? palette.dark : palette.soil
  }

  if (tile.kind === "built") {
    return random() > 0.58 ? palette.dark : palette.light
  }

  return random() > 0.64 ? palette.light : random() > 0.34 ? palette.dark : palette.accent
}

function paletteFor(tile: FormalPixelTileRenderItem): GroundPalette {
  const palettes: Record<FormalPixelTileRenderItem["kind"], GroundPalette> = {
    grass: { base: "#3f7d3c", dark: "#326832", light: "#69a64c", accent: "#4d8d3f", soil: "#675234" },
    pressed_grass: { base: "#376f36", dark: "#2a5a2d", light: "#5d9147", accent: "#456f3b", soil: "#665238" },
    worn_grass: { base: "#556b35", dark: "#46592f", light: "#738846", accent: "#6d6a3b", soil: "#745939" },
    exposed_soil: { base: "#7a5b37", dark: "#604429", light: "#9a7444", accent: "#876333", soil: "#5b3f27" },
    ecology_transition: { base: "#476f48", dark: "#315c38", light: "#71964f", accent: "#5f7f4b", soil: "#66543b" },
    recovery_growth: { base: "#4f8a42", dark: "#3b7338", light: "#79b95a", accent: "#5fae50", soil: "#645437" },
    soil: { base: "#6f5130", dark: "#543b24", light: "#916a3d", accent: "#7a5930", soil: "#503821" },
    built: { base: "#695949", dark: "#4e4236", light: "#86725b", accent: "#75634c", soil: "#5a4532" },
    boundary: { base: "#18231f", dark: "#0e1614", light: "#27362f", accent: "#1f2c28", soil: "#141c19" },
  }

  const basePalette = palettes[tile.kind]
  if (tile.traceIntensity <= 0) return basePalette

  const amount = tile.traceIntensity >= 70 ? 26 : tile.traceIntensity >= 35 ? 14 : 6
  return {
    base: darken(basePalette.base, amount),
    dark: darken(basePalette.dark, amount),
    light: darken(basePalette.light, Math.round(amount * 0.55)),
    accent: darken(basePalette.accent, amount),
    soil: basePalette.soil,
  }
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

function darken(hex: string, amount: number): string {
  const value = hex.replace("#", "")
  const r = Math.max(0, Number.parseInt(value.slice(0, 2), 16) - amount)
  const g = Math.max(0, Number.parseInt(value.slice(2, 4), 16) - amount)
  const b = Math.max(0, Number.parseInt(value.slice(4, 6), 16) - amount)
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function toHex(value: number): string {
  return value.toString(16).padStart(2, "0")
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
