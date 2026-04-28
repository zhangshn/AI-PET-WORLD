/**
 * 当前文件负责：渲染宠物角色的像素图形。
 */

import { Graphics } from "pixi.js"

import type { PetState } from "@/types/pet"

import { STAGE_VISUAL_CONFIG } from "../../config/stage-visual-config"
import { lightenColor } from "../../shared/stage-renderer-utils"
import { drawActorShadow } from "./actor-shape-utils"

export function drawPetGraphic(
  graphic: Graphics,
  pet: PetState | null,
  phase: number
) {
  graphic.clear()

  const visual = STAGE_VISUAL_CONFIG.actor.petDefault
  const color = getPetColor(pet)
  const blink = Math.sin(phase * 1.4) > 0.96
  const moving = pet?.action === "walking" || pet?.action === "exploring"
  const step = moving ? Math.sin(phase * 7) * 1.5 : 0

  if (pet?.action === "sleeping") {
    drawActorShadow(graphic, 12, 20, 15, 5, 0.18)

    graphic.rect(0, 8, 26, 13).fill(color)
    graphic.rect(4, 3, 14, 8).fill(lightenColor(color, 8))
    graphic.rect(2, 19, 22, 3).fill({
      color: visual.outline,
      alpha: 0.18,
    })

    graphic.rect(6, 8, 3, 2).fill(visual.dark)
    graphic.rect(28, -4, 5, 5).fill(0xe2e8f0)
    graphic.rect(35, -11, 6, 6).fill(STAGE_VISUAL_CONFIG.highlightColor)
    return
  }

  drawActorShadow(graphic, 11, 24, 14, 5, 0.2)

  graphic.rect(0, 5, 22, 15).fill(color)
  graphic.rect(3, 0, 16, 9).fill(lightenColor(color, 8))

  graphic.rect(2, -3, 5, 5).fill(lightenColor(color, 5))
  graphic.rect(15, -3, 5, 5).fill(lightenColor(color, 5))

  if (blink) {
    graphic.rect(5, 4, 4, 1).fill(visual.dark)
    graphic.rect(14, 4, 4, 1).fill(visual.dark)
  } else {
    graphic.rect(6, 3, 3, 3).fill(visual.dark)
    graphic.rect(14, 3, 3, 3).fill(visual.dark)
    graphic.rect(7, 3, 1, 1).fill(STAGE_VISUAL_CONFIG.highlightColor)
    graphic.rect(15, 3, 1, 1).fill(STAGE_VISUAL_CONFIG.highlightColor)
  }

  graphic.rect(10, 8, 3, 2).fill({
    color: visual.skinShadow,
    alpha: 0.45,
  })

  graphic.rect(2, 19, 5, 5 + Math.max(0, step)).fill(visual.dark)
  graphic.rect(15, 19, 5, 5 + Math.max(0, -step)).fill(visual.dark)

  if (pet?.action === "observing") {
    graphic.rect(22, 6, 5, 2).fill({
      color: STAGE_VISUAL_CONFIG.highlightColor,
      alpha: 0.35,
    })
  }

  if (pet?.action === "eating") {
    graphic.rect(22, 15, 5, 4).fill(visual.cloth)
    graphic.rect(24, 12, 2, 3).fill(0x22c55e)
  }
}

export function getPetBob(action?: string, phase = 0): number {
  if (action === "sleeping") return Math.sin(phase * 1.6) * 0.45
  if (action === "exploring") return Math.sin(phase * 6.5) * 2.2
  if (action === "walking") return Math.sin(phase * 6) * 1.8

  return Math.sin(phase * 3) * 0.8
}

function getPetColor(pet: PetState | null): number {
  const visual = STAGE_VISUAL_CONFIG.actor.petDefault

  if (!pet) return visual.skin
  if (pet.action === "sleeping") return 0x94a3b8
  if (pet.action === "eating") return visual.cloth
  if (pet.action === "resting") return 0xa7f3d0
  if (pet.mood === "happy") return visual.cloth
  if (pet.mood === "alert") return 0xef4444
  if (pet.mood === "curious") return 0x22c55e

  return visual.skin
}