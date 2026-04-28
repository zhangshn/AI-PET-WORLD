/**
 * 当前文件负责：渲染住所室内的初始生命舱与孵化器状态。
 */

import { Graphics } from "pixi.js"

import type { IncubatorState } from "@/types/incubator"
import type { PetState } from "@/types/pet"

import { STAGE_VISUAL_CONFIG } from "../../config/stage-visual-config"
import {
  darkenColor,
  lightenColor,
} from "../../shared/stage-renderer-utils"

type IncubatorInteriorMode =
  | "active_hatching"
  | "empty_resting"
  | "birth_memory_capsule"

export function drawIncubatorStation(
  graphic: Graphics,
  x: number,
  y: number,
  incubator: IncubatorState | null,
  pet: PetState | null
) {
  const mode = resolveIncubatorInteriorMode(incubator, pet)
  const visual = STAGE_VISUAL_CONFIG.actor.incubator
  const progress = incubator?.progress ?? 0
  const isActive = mode === "active_hatching"

  graphic.rect(x - 28, y + 142, 250, 28).fill({
    color: 0x0f172a,
    alpha: 0.24,
  })

  graphic.rect(x, y + 84, 192, 78).fill(0x263542)
  graphic.rect(x + 12, y + 96, 168, 54).fill(0x17212b)

  graphic.rect(x + 32, y, 128, 116).fill({
    color: visual.shell,
    alpha: isActive ? 0.96 : 0.58,
  })

  graphic.rect(x + 42, y + 10, 108, 18).fill({
    color: lightenColor(visual.shell, 16),
    alpha: isActive ? 0.9 : 0.45,
  })

  graphic.rect(x + 46, y + 32, 100, 62).fill({
    color: visual.panel,
    alpha: isActive ? 0.92 : 0.54,
  })

  graphic.rect(x + 52, y + 38, 88, 48).stroke({
    color: getIncubatorGlowColor(mode),
    alpha: isActive ? 0.95 : 0.48,
    width: 4,
  })

  graphic.rect(x + 66, y + 58, 60, 12).fill({
    color: visual.glass,
    alpha: isActive ? 0.22 : 0.1,
  })

  if (isActive) {
    graphic.rect(x + 66, y + 100, 60, 8).fill({
      color: darkenColor(visual.glass, 36),
      alpha: 0.32,
    })

    graphic.rect(x + 66, y + 100, Math.max(3, (60 * progress) / 100), 8).fill({
      color: visual.stableGlow,
      alpha: 0.88,
    })
  } else {
    graphic.rect(x + 65, y + 101, 62, 7).fill({
      color: 0x64748b,
      alpha: 0.24,
    })
  }

  graphic.circle(x + 96, y + 62, 14).fill({
    color: getIncubatorGlowColor(mode),
    alpha: isActive ? 0.22 : 0.1,
  })

  graphic.rect(x + 38, y + 116, 116, 10).fill({
    color: visual.dark,
    alpha: 0.34,
  })

  drawIncubatorModeBadge(graphic, x + 172, y + 34, mode)
}

function drawIncubatorModeBadge(
  graphic: Graphics,
  x: number,
  y: number,
  mode: IncubatorInteriorMode
) {
  const color = getIncubatorGlowColor(mode)

  graphic.rect(x, y, 104, 30).fill({
    color: 0x0f172a,
    alpha: 0.58,
  })

  graphic.rect(x + 8, y + 9, 12, 12).fill({
    color,
    alpha: 0.88,
  })

  graphic.rect(x + 27, y + 10, 64, 3).fill({
    color,
    alpha: 0.4,
  })

  graphic.rect(x + 27, y + 17, 48, 3).fill({
    color,
    alpha: 0.24,
  })
}

function resolveIncubatorInteriorMode(
  incubator: IncubatorState | null,
  pet: PetState | null
): IncubatorInteriorMode {
  const hasPetBorn = Boolean(pet)

  if (!hasPetBorn && incubator?.status !== "hatched") {
    return "active_hatching"
  }

  if (
    pet?.lifeState?.phase === "newborn" ||
    pet?.lifeState?.phase === "adaptation"
  ) {
    return "empty_resting"
  }

  return "birth_memory_capsule"
}

function getIncubatorGlowColor(mode: IncubatorInteriorMode): number {
  if (mode === "active_hatching") return 0x67e8f9
  if (mode === "empty_resting") return 0x94a3b8

  return 0xfacc15
}