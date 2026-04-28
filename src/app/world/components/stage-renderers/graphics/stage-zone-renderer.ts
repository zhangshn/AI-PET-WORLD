/**
 * 当前文件负责：渲染世界生态区域的轻量视觉提示。
 */

import { Container, Graphics } from "pixi.js"

import type { WorldEcologyState, WorldZone } from "@/world/ecology/ecology-engine"

import { STAGE_VISUAL_CONFIG } from "../config/stage-visual-config"
import { lightenColor } from "../shared/stage-renderer-utils"

export type SyncWorldZonesInput = {
  layer: Container
  ecology: WorldEcologyState | null
}

const ZONE_TILE_SIZE = 24

export function syncWorldZoneVisuals(input: SyncWorldZonesInput) {
  input.layer.removeChildren()

  if (!input.ecology) return

  const graphic = new Graphics()

  for (const zone of input.ecology.zones) {
    drawZoneCue(graphic, zone)
  }

  input.layer.addChild(graphic)
}

export function getActiveZonePosition(
  ecology: WorldEcologyState | null,
  zoneId: string
): { x: number; y: number } | null {
  const zone = ecology?.zones.find((item) => item.id === zoneId)

  if (!zone) return null

  return {
    x: zone.center.x * ZONE_TILE_SIZE,
    y: zone.center.y * ZONE_TILE_SIZE,
  }
}

function drawZoneCue(graphic: Graphics, zone: WorldZone) {
  if (zone.type === "water") {
    drawWaterZoneCue(graphic, zone)
    return
  }

  if (zone.type === "shelter") {
    drawShelterZoneCue(graphic, zone)
    return
  }

  if (zone.type === "food") {
    drawFoodZoneCue(graphic, zone)
    return
  }

  drawNaturalZoneCue(graphic, zone)
}

function drawNaturalZoneCue(graphic: Graphics, zone: WorldZone) {
  const x = zone.center.x * ZONE_TILE_SIZE
  const y = zone.center.y * ZONE_TILE_SIZE
  const radius = Math.max(18, zone.radius * ZONE_TILE_SIZE * 0.28)
  const baseColor = STAGE_VISUAL_CONFIG.tiles.short_grass.light
  const accentColor = STAGE_VISUAL_CONFIG.actor.butlerDefault.accent

  graphic.circle(x, y, radius).fill({
    color: baseColor,
    alpha: 0.035,
  })

  graphic.circle(x, y, Math.max(4, radius * 0.18)).fill({
    color: accentColor,
    alpha: 0.08,
  })
}

function drawWaterZoneCue(graphic: Graphics, zone: WorldZone) {
  const x = zone.center.x * ZONE_TILE_SIZE
  const y = zone.center.y * ZONE_TILE_SIZE
  const radius = Math.max(20, zone.radius * ZONE_TILE_SIZE * 0.3)
  const water = STAGE_VISUAL_CONFIG.tiles.water

  graphic.circle(x, y, radius).fill({
    color: water.light,
    alpha: 0.06,
  })

  graphic.circle(x, y, Math.max(6, radius * 0.25)).fill({
    color: water.detail,
    alpha: 0.08,
  })
}

function drawShelterZoneCue(graphic: Graphics, zone: WorldZone) {
  const x = zone.center.x * ZONE_TILE_SIZE
  const y = zone.center.y * ZONE_TILE_SIZE
  const radius = Math.max(20, zone.radius * ZONE_TILE_SIZE * 0.28)
  const shelter = STAGE_VISUAL_CONFIG.tiles.shelter_foundation
  const butler = STAGE_VISUAL_CONFIG.actor.butlerDefault

  graphic.circle(x, y, radius).fill({
    color: shelter.light,
    alpha: 0.055,
  })

  graphic.circle(x, y, Math.max(5, radius * 0.2)).fill({
    color: lightenColor(butler.cloth, 18),
    alpha: 0.08,
  })
}

function drawFoodZoneCue(graphic: Graphics, zone: WorldZone) {
  const x = zone.center.x * ZONE_TILE_SIZE
  const y = zone.center.y * ZONE_TILE_SIZE
  const radius = Math.max(20, zone.radius * ZONE_TILE_SIZE * 0.28)
  const flower = STAGE_VISUAL_CONFIG.tiles.flower_patch
  const garden = STAGE_VISUAL_CONFIG.tiles.garden_soil

  graphic.circle(x, y, radius).fill({
    color: flower.light,
    alpha: 0.045,
  })

  graphic.circle(x, y, Math.max(5, radius * 0.2)).fill({
    color: garden.detail,
    alpha: 0.08,
  })
}