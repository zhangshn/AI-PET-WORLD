/**
 * 当前文件负责：渲染管家角色的像素图形。
 */

import { Graphics } from "pixi.js"

import type { ButlerState } from "@/types/butler"

import { STAGE_VISUAL_CONFIG } from "../../config/stage-visual-config"
import { darkenColor } from "../../shared/stage-renderer-utils"
import { drawActorShadow } from "./actor-shape-utils"

export function drawButlerGraphic(
  graphic: Graphics,
  butler: ButlerState | null,
  phase: number
) {
  graphic.clear()

  const task = butler?.task
  const visual = STAGE_VISUAL_CONFIG.actor.butler
  const working = task === "watching_incubator" || task === "building_home"
  const bob = working
    ? Math.sin(phase * 5.5) * 1.1
    : Math.sin(phase * 2.5) * 0.45

  drawActorShadow(graphic, 9, 67, 15, 5, 0.22)

  const bodyY = bob

  graphic.rect(3, bodyY, 12, 10).fill(visual.skin)
  graphic.rect(5, bodyY + 2, 3, 2).fill(visual.outline)
  graphic.rect(11, bodyY + 2, 3, 2).fill(visual.outline)
  graphic.rect(7, bodyY + 7, 5, 2).fill({
    color: visual.skinShadow,
    alpha: 0.42,
  })

  graphic.rect(0, bodyY + 10, 18, 28).fill(darkenColor(visual.cloth, 24))
  graphic.rect(3, bodyY + 12, 12, 22).fill(visual.cloth)
  graphic.rect(6, bodyY + 10, 6, 28).fill({
    color: visual.clothLight,
    alpha: 0.22,
  })

  graphic.rect(-4, bodyY + 15, 5, 19).fill(visual.skin)
  graphic.rect(17, bodyY + 15, 5, 19).fill(visual.skin)

  if (working) {
    graphic.rect(20, bodyY + 22, 11, 4).fill(0x8b5a2b)
    graphic.rect(28, bodyY + 17, 5, 12).fill(0x6b3f1d)
  }

  graphic.rect(3, bodyY + 38, 5, 22).fill(darkenColor(visual.dark, 6))
  graphic.rect(11, bodyY + 38, 5, 22).fill(darkenColor(visual.dark, 6))

  graphic.rect(1, bodyY + 60, 8, 4).fill(visual.dark)
  graphic.rect(10, bodyY + 60, 8, 4).fill(visual.dark)

  graphic.rect(2, bodyY - 4, 14, 4).fill(0x3f2a18)
  graphic.rect(0, bodyY - 1, 18, 3).fill(0x5a3b22)
}