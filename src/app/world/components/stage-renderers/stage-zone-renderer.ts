/**
 * 当前文件负责：渲染世界生态区域的自然化环境线索。
 */

import { Container, Graphics } from "pixi.js"

import type { WorldEcologyState } from "@/world/ecology/ecology-engine"
import type { WorldZone } from "@/world/ecology/world-zone-types"

import { STAGE_VISUAL_CONFIG } from "./config/stage-visual-config"
import { lightenColor } from "./shared/stage-renderer-utils"

export type SyncWorldZonesInput = {
  layer: Container
  ecology: WorldEcologyState | null
}

export function syncWorldZoneVisuals(input: SyncWorldZonesInput) {
  input.layer.removeChildren()

  if (!input.ecology) return

  for (const zone of input.ecology.zones) {
    if (!zone.isActive) continue

    const graphic = new Graphics()

    drawNaturalZoneCue(graphic, zone)

    graphic.x = zone.x
    graphic.y = zone.y

    input.layer.addChild(graphic)
  }
}

export function getActiveZonePosition(
  ecology: WorldEcologyState | null,
  zoneType: WorldZone["type"]
): { x: number; y: number } | null {
  const zone = ecology?.zones.find(
    (item) => item.type === zoneType && item.isActive
  )

  if (!zone) return null

  return {
    x: zone.x,
    y: zone.y,
  }
}

function drawNaturalZoneCue(graphic: Graphics, zone: WorldZone) {
  if (zone.type === "sleep_zone") {
    drawSoftPixelMist(graphic, zone, STAGE_VISUAL_CONFIG.actor.butler.clothLight)
    return
  }

  if (zone.type === "food_zone") {
    drawFoodCue(graphic, zone)
    return
  }

  if (zone.type === "warm_zone") {
    drawWarmLightCue(graphic, zone)
    return
  }

  if (zone.type === "quiet_zone") {
    drawQuietCue(graphic, zone)
    return
  }

  if (zone.type === "observation_zone") {
    drawObservationCue(graphic, zone)
    return
  }

  if (zone.type === "incubator_zone") {
    drawIncubatorCue(graphic, zone)
    return
  }

  if (zone.type === "home_build_zone") {
    drawBuildCue(graphic, zone)
    return
  }

  if (zone.type === "exploration_zone") {
    drawExplorationCue(graphic, zone)
    return
  }

  drawGenericZoneCue(graphic, zone)
}

function drawSoftPixelMist(
  graphic: Graphics,
  zone: WorldZone,
  color: number
) {
  const seed = getZoneSeed(zone)

  for (let index = 0; index < 5; index += 1) {
    const offset = getRadialOffset(seed + index * 17, zone.radius * 0.45)

    graphic.rect(offset.x, offset.y, 12, 4).fill({
      color,
      alpha: 0.055,
    })
  }
}

function drawFoodCue(graphic: Graphics, zone: WorldZone) {
  const seed = getZoneSeed(zone)
  const foodColor = STAGE_VISUAL_CONFIG.actor.petDefault.cloth
  const leafColor = STAGE_VISUAL_CONFIG.effect.leaf

  for (let index = 0; index < 4; index += 1) {
    const offset = getRadialOffset(seed + index * 19, zone.radius * 0.32)

    graphic.rect(offset.x, offset.y, 5, 4).fill({
      color: foodColor,
      alpha: 0.18,
    })

    graphic.rect(offset.x + 2, offset.y - 3, 2, 3).fill({
      color: leafColor,
      alpha: 0.16,
    })
  }
}

function drawWarmLightCue(graphic: Graphics, zone: WorldZone) {
  graphic.circle(0, 0, Math.max(12, zone.radius * 0.38)).fill({
    color: STAGE_VISUAL_CONFIG.effect.warmLight,
    alpha: 0.018,
  })

  const seed = getZoneSeed(zone)

  for (let index = 0; index < 4; index += 1) {
    const offset = getRadialOffset(seed + index * 23, zone.radius * 0.35)

    graphic.rect(offset.x, offset.y, 10, 2).fill({
      color: STAGE_VISUAL_CONFIG.effect.warmLight,
      alpha: 0.1,
    })
  }
}

function drawQuietCue(graphic: Graphics, zone: WorldZone) {
  const seed = getZoneSeed(zone)
  const color = STAGE_VISUAL_CONFIG.effect.breeze

  for (let index = 0; index < 4; index += 1) {
    const offset = getRadialOffset(seed + index * 29, zone.radius * 0.35)

    graphic.rect(offset.x, offset.y, 14, 2).fill({
      color,
      alpha: 0.055,
    })
  }
}

function drawObservationCue(graphic: Graphics, zone: WorldZone) {
  const seed = getZoneSeed(zone)
  const leafColor = STAGE_VISUAL_CONFIG.effect.leaf

  for (let index = 0; index < 5; index += 1) {
    const offset = getRadialOffset(seed + index * 31, zone.radius * 0.42)

    graphic.rect(offset.x, offset.y, 4, 4).fill({
      color: lightenColor(leafColor, 36),
      alpha: 0.13,
    })

    if (index % 2 === 0) {
      graphic.rect(offset.x + 6, offset.y + 3, 5, 2).fill({
        color: leafColor,
        alpha: 0.08,
      })
    }
  }
}

function drawIncubatorCue(graphic: Graphics, zone: WorldZone) {
  const glass = STAGE_VISUAL_CONFIG.actor.incubator.glass

  graphic.circle(0, 0, Math.max(10, zone.radius * 0.28)).stroke({
    color: glass,
    alpha: 0.08,
    width: 2,
  })

  graphic.rect(-8, -1, 16, 2).fill({
    color: lightenColor(glass, 40),
    alpha: 0.12,
  })
}

function drawBuildCue(graphic: Graphics, zone: WorldZone) {
  const seed = getZoneSeed(zone)
  const woodColor = STAGE_VISUAL_CONFIG.tiles.shelter_foundation.edge

  for (let index = 0; index < 4; index += 1) {
    const offset = getRadialOffset(seed + index * 13, zone.radius * 0.3)

    graphic.rect(offset.x, offset.y, 10, 3).fill({
      color: woodColor,
      alpha: 0.12,
    })
  }
}

function drawExplorationCue(graphic: Graphics, zone: WorldZone) {
  const seed = getZoneSeed(zone)
  const color = STAGE_VISUAL_CONFIG.actor.petDefault.cloth

  for (let index = 0; index < 6; index += 1) {
    const offset = getRadialOffset(seed + index * 37, zone.radius * 0.45)

    graphic.rect(offset.x, offset.y, 3, 3).fill({
      color,
      alpha: 0.12,
    })
  }
}

function drawGenericZoneCue(graphic: Graphics, zone: WorldZone) {
  const seed = getZoneSeed(zone)

  for (let index = 0; index < 3; index += 1) {
    const offset = getRadialOffset(seed + index * 11, zone.radius * 0.3)

    graphic.rect(offset.x, offset.y, 5, 3).fill({
      color: STAGE_VISUAL_CONFIG.highlightColor,
      alpha: 0.06,
    })
  }
}

function getRadialOffset(
  seed: number,
  radius: number
): { x: number; y: number } {
  const angle = (seed % 360) * (Math.PI / 180)
  const distance = Math.max(6, radius * (0.35 + (seed % 40) / 100))

  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
  }
}

function getZoneSeed(zone: WorldZone): number {
  let seed = Math.round(zone.x * 13 + zone.y * 17 + zone.radius * 19)

  for (let index = 0; index < zone.type.length; index += 1) {
    seed += zone.type.charCodeAt(index) * (index + 5)
  }

  return Math.abs(seed)
}

