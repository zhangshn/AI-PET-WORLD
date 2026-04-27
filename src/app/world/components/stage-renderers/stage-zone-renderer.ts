/**
 * 当前文件负责：渲染世界生态区域的可视化范围。
 */

import { Container, Graphics } from "pixi.js"

import type { WorldEcologyState } from "@/world/ecology/ecology-engine"
import type { WorldZone } from "@/world/ecology/world-zone-types"

export type SyncWorldZonesInput = {
  layer: Container
  ecology: WorldEcologyState | null
}

export function syncWorldZoneVisuals(input: SyncWorldZonesInput) {
  input.layer.removeChildren()

  if (!input.ecology) return

  for (const zone of input.ecology.zones) {
    if (!zone.isActive) continue

    const visual = getZoneVisual(zone)
    const graphic = new Graphics()

    graphic.circle(0, 0, zone.radius).fill({
      color: visual.color,
      alpha: visual.alpha,
    })

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

function getZoneVisual(zone: WorldZone): { color: number; alpha: number } {
  if (zone.type === "sleep_zone") return { color: 0x818cf8, alpha: 0.025 }
  if (zone.type === "food_zone") return { color: 0xf97316, alpha: 0.025 }
  if (zone.type === "warm_zone") return { color: 0xf59e0b, alpha: 0.03 }
  if (zone.type === "quiet_zone") return { color: 0x60a5fa, alpha: 0.025 }
  if (zone.type === "observation_zone") return { color: 0x22c55e, alpha: 0.025 }
  if (zone.type === "incubator_zone") return { color: 0x38bdf8, alpha: 0.025 }
  if (zone.type === "home_build_zone") return { color: 0xa78bfa, alpha: 0.025 }
  if (zone.type === "exploration_zone") return { color: 0xfacc15, alpha: 0.02 }

  return { color: 0x94a3b8, alpha: 0.02 }
}