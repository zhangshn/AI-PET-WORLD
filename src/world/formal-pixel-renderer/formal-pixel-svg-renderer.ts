// 该文件用于把正式像素渲染模型转换成 SVG 像素画面。

import type {
  FormalPixelActorRenderItem,
  FormalPixelAtmosphereRenderItem,
  FormalPixelObjectRenderItem,
  FormalPixelRenderModel,
  FormalPixelTileRenderItem,
  FormalPixelTraceRenderItem,
} from "./formal-pixel-renderer-schema"

export function buildFormalPixelSvg(model: FormalPixelRenderModel): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${model.canvas.width}" height="${model.canvas.height}" viewBox="0 0 ${model.canvas.width} ${model.canvas.height}" shape-rendering="crispEdges" data-formal-pixel-renderer="v0" data-world-id="${escapeText(model.worldId)}" data-tick="${model.tick}">`,
    `<rect x="0" y="0" width="${model.canvas.width}" height="${model.canvas.height}" fill="#17231f"/>`,
    `<g data-layer="tile">${model.layers.tiles.items.map(renderTile).join("\n")}</g>`,
    `<g data-layer="trace">${model.layers.traces.items.map(renderTrace).join("\n")}</g>`,
    `<g data-layer="object">${model.layers.objects.items.map(renderObject).join("\n")}</g>`,
    `<g data-layer="actor">${model.layers.actors.items.map(renderActor).join("\n")}</g>`,
    `<g data-layer="atmosphere">${model.layers.atmosphere.items.map((item) => renderAtmosphere(item, model.canvas.width, model.canvas.height)).join("\n")}</g>`,
    `</svg>`,
  ].join("\n")
}

function renderTile(tile: FormalPixelTileRenderItem): string {
  const fill = tileColor(tile)
  const opacity = tile.passable ? 1 : 0.92
  return `<rect data-id="${escapeText(tile.id)}" x="${tile.x}" y="${tile.y}" width="${tile.width}" height="${tile.height}" fill="${fill}" opacity="${opacity}"/>`
}

function renderTrace(trace: FormalPixelTraceRenderItem): string {
  const fill = traceColor(trace)
  const opacity = clamp(trace.opacity * (0.25 + trace.intensity / 135), 0.12, 0.82)
  return `<ellipse data-id="${escapeText(trace.id)}" cx="${trace.x}" cy="${trace.y}" rx="${Math.max(4, trace.radius)}" ry="${Math.max(2, Math.round(trace.radius * 0.42))}" fill="${fill}" opacity="${opacity}"/>`
}

function renderObject(object: FormalPixelObjectRenderItem): string {
  if (object.kind === "tree") return renderTreeObject(object)
  if (object.kind === "bush") return renderBushObject(object)
  if (object.kind === "stone") return renderStoneObject(object)
  if (object.kind === "flower") return renderFlowerObject(object)
  if (object.kind === "mushroom") return renderMushroomObject(object)
  if (object.kind === "structure" || object.kind === "facility") return renderStructureObject(object)

  return renderSignalObject(object)
}

function renderTreeObject(object: FormalPixelObjectRenderItem): string {
  const size = Math.max(8, Math.round(18 * object.scale))
  const trunkWidth = Math.max(4, Math.round(size * 0.22))
  const trunkHeight = Math.max(8, Math.round(size * 0.72))
  const crownWidth = Math.max(14, Math.round(size * 1.28))
  const crownHeight = Math.max(12, Math.round(size * 0.92))
  const x = Math.round(object.x)
  const y = Math.round(object.y)
  const palette = object.health >= 80
    ? { leaf: "#3f873d", light: "#7ec35c", dark: "#154526", trunk: "#8a5a31", trunkDark: "#5a351f" }
    : object.health >= 45
      ? { leaf: "#608c45", light: "#a5b963", dark: "#284b2a", trunk: "#8d6236", trunkDark: "#5c3b21" }
      : { leaf: "#74834b", light: "#aaa45f", dark: "#3d4f2c", trunk: "#87623a", trunkDark: "#56381f" }

  return [
    `<g data-id="${escapeText(object.id)}" data-object-kind="tree" opacity="${object.opacity}">`,
    `<ellipse cx="${x}" cy="${y + 5}" rx="${Math.round(crownWidth * 0.42)}" ry="${Math.max(3, Math.round(crownHeight * 0.18))}" fill="#142319" opacity="0.28"/>`,
    `<rect x="${x - Math.round(trunkWidth / 2)}" y="${y - trunkHeight}" width="${trunkWidth}" height="${trunkHeight}" fill="${palette.trunkDark}"/>`,
    `<rect x="${x - Math.round(trunkWidth / 2) + 1}" y="${y - trunkHeight + 1}" width="${Math.max(1, trunkWidth - 2)}" height="${Math.max(1, trunkHeight - 2)}" fill="${palette.trunk}"/>`,
    `<rect x="${x - Math.round(crownWidth / 2)}" y="${y - trunkHeight - crownHeight + 2}" width="${crownWidth}" height="${Math.round(crownHeight * 0.58)}" fill="${palette.dark}"/>`,
    `<rect x="${x - Math.round(crownWidth * 0.42)}" y="${y - trunkHeight - crownHeight}" width="${Math.round(crownWidth * 0.84)}" height="${Math.round(crownHeight * 0.7)}" fill="${palette.leaf}"/>`,
    `<rect x="${x - Math.round(crownWidth * 0.28)}" y="${y - trunkHeight - crownHeight + 3}" width="${Math.round(crownWidth * 0.38)}" height="${Math.max(3, Math.round(crownHeight * 0.18))}" fill="${palette.light}"/>`,
    `<rect x="${x + Math.round(crownWidth * 0.12)}" y="${y - trunkHeight - Math.round(crownHeight * 0.46)}" width="${Math.round(crownWidth * 0.26)}" height="${Math.max(3, Math.round(crownHeight * 0.16))}" fill="${palette.dark}"/>`,
    `</g>`,
  ].join("\n")
}

function renderBushObject(object: FormalPixelObjectRenderItem): string {
  const size = Math.max(8, Math.round(12 * object.scale))
  return `<g data-id="${escapeText(object.id)}" data-object-kind="bush" opacity="${object.opacity}"><rect x="${object.x - size}" y="${object.y - Math.round(size * 0.6)}" width="${size * 2}" height="${size}" fill="#286333"/><rect x="${object.x - Math.round(size * 0.55)}" y="${object.y - size}" width="${size}" height="${Math.round(size * 0.55)}" fill="#5da34d"/></g>`
}

function renderStoneObject(object: FormalPixelObjectRenderItem): string {
  const size = Math.max(5, Math.round(9 * object.scale))
  return `<g data-id="${escapeText(object.id)}" data-object-kind="stone" opacity="${object.opacity}"><rect x="${object.x - size}" y="${object.y - Math.round(size * 0.65)}" width="${size * 2}" height="${size}" fill="#6f766e"/><rect x="${object.x - Math.round(size * 0.4)}" y="${object.y - Math.round(size * 0.9)}" width="${size}" height="${Math.max(2, Math.round(size * 0.35))}" fill="#a4aaa0"/></g>`
}

function renderFlowerObject(object: FormalPixelObjectRenderItem): string {
  return `<g data-id="${escapeText(object.id)}" data-object-kind="flower" opacity="${object.opacity}"><rect x="${object.x}" y="${object.y - 7}" width="2" height="7" fill="#4c8a43"/><rect x="${object.x - 2}" y="${object.y - 9}" width="6" height="4" fill="#d7b9df"/></g>`
}

function renderMushroomObject(object: FormalPixelObjectRenderItem): string {
  return `<g data-id="${escapeText(object.id)}" data-object-kind="mushroom" opacity="${object.opacity}"><rect x="${object.x - 1}" y="${object.y - 6}" width="3" height="6" fill="#d9c29a"/><rect x="${object.x - 5}" y="${object.y - 10}" width="11" height="5" fill="#ba574b"/></g>`
}

function renderStructureObject(object: FormalPixelObjectRenderItem): string {
  const width = Math.max(18, Math.round(34 * object.scale))
  const height = Math.max(14, Math.round(28 * object.scale))
  return `<g data-id="${escapeText(object.id)}" data-object-kind="${object.kind}" opacity="${object.opacity}"><rect x="${object.x - Math.round(width / 2)}" y="${object.y - height}" width="${width}" height="${height}" fill="#8a6a48"/><rect x="${object.x - Math.round(width / 2) - 3}" y="${object.y - height - 8}" width="${width + 6}" height="8" fill="#5e4632"/></g>`
}

function renderSignalObject(object: FormalPixelObjectRenderItem): string {
  return `<rect data-id="${escapeText(object.id)}" data-object-kind="${object.kind}" x="${object.x - 2}" y="${object.y - 2}" width="4" height="4" fill="#d8ead8" opacity="${object.opacity}"/>`
}

function renderActor(actor: FormalPixelActorRenderItem): string {
  if (!actor.visible) return ""
  if (actor.kind === "pet") return ""

  const x = Math.round(actor.x)
  const y = Math.round(actor.y)
  return [
    `<g data-id="${escapeText(actor.id)}" data-actor-kind="${actor.kind}" data-pose="${actor.pose}">`,
    `<ellipse cx="${x}" cy="${y + 4}" rx="8" ry="3" fill="#101815" opacity="0.35"/>`,
    `<rect x="${x - 5}" y="${y - 22}" width="10" height="14" fill="#324f46"/>`,
    `<rect x="${x - 4}" y="${y - 31}" width="8" height="8" fill="#c7b08a"/>`,
    `<rect x="${x - 6}" y="${y - 25}" width="3" height="9" fill="#263d36"/>`,
    `<rect x="${x + 3}" y="${y - 25}" width="3" height="9" fill="#263d36"/>`,
    `<rect x="${x - 4}" y="${y - 8}" width="3" height="8" fill="#22342f"/>`,
    `<rect x="${x + 1}" y="${y - 8}" width="3" height="8" fill="#22342f"/>`,
    `</g>`,
  ].join("\n")
}

function renderAtmosphere(atmosphere: FormalPixelAtmosphereRenderItem, width: number, height: number): string {
  const fill = atmosphere.mood === "warm" ? "#e5b76a" : atmosphere.mood === "recovering" ? "#85c79b" : atmosphere.mood === "busy" ? "#d7d889" : "#6fa38c"
  const weatherOpacity = atmosphere.weather === "damp" ? 0.12 : atmosphere.weather === "soft" ? 0.08 : 0.04
  return `<rect data-id="${escapeText(atmosphere.id)}" x="0" y="0" width="${width}" height="${height}" fill="${fill}" opacity="${clamp(atmosphere.opacity * weatherOpacity, 0, 0.18)}"/>`
}

function tileColor(tile: FormalPixelTileRenderItem): string {
  const colors: Record<FormalPixelTileRenderItem["kind"], string> = {
    grass: "#3f7d3c",
    pressed_grass: "#376f36",
    worn_grass: "#556b35",
    exposed_soil: "#7a5b37",
    ecology_transition: "#476f48",
    recovery_growth: "#4f8a42",
    soil: "#6f5130",
    built: "#695949",
    boundary: "#18231f",
  }
  const base = colors[tile.kind]
  if (tile.traceIntensity <= 0) return base
  return tile.traceIntensity >= 70 ? darken(base, 34) : tile.traceIntensity >= 35 ? darken(base, 20) : darken(base, 8)
}

function traceColor(trace: FormalPixelTraceRenderItem): string {
  if (trace.visualKind === "exposed_soil") return "#7d5a35"
  if (trace.visualKind === "worn_grass") return "#5f713a"
  if (trace.visualKind === "pressed_grass") return "#315f32"
  return "#6c7b46"
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
