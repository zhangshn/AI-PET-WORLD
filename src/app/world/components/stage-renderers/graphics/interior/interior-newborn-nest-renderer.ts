/**
 * 当前文件负责：渲染住所室内的新生宠物小窝。
 */

import { Graphics } from "pixi.js"

import type { IncubatorState } from "@/types/incubator"
import type { PetState } from "@/types/pet"

import { STAGE_VISUAL_CONFIG } from "../../config/stage-visual-config"
import { lightenColor } from "../../shared/stage-renderer-utils"
import { shouldRenderInteriorNewbornNest } from "../actors/stage-pet-visibility"

export function drawNewbornNest(
  graphic: Graphics,
  x: number,
  y: number,
  incubator: IncubatorState | null,
  pet: PetState | null
) {
  const showPet = shouldRenderInteriorNewbornNest({ pet, incubator })

  graphic.rect(x - 18, y + 56, 172, 20).fill({
    color: 0x0f172a,
    alpha: 0.2,
  })

  graphic.rect(x, y + 12, 132, 58).fill(0x5f3a24)
  graphic.rect(x + 9, y + 20, 114, 38).fill(0x7a4a2a)
  graphic.rect(x + 18, y + 27, 96, 24).fill({
    color: 0xffd6a5,
    alpha: 0.88,
  })

  graphic.rect(x + 26, y + 31, 80, 16).fill({
    color: 0xfef3c7,
    alpha: 0.65,
  })

  if (!showPet) {
    graphic.rect(x + 36, y + 34, 58, 5).fill({
      color: 0x94a3b8,
      alpha: 0.22,
    })
    return
  }

  const petColor = STAGE_VISUAL_CONFIG.actor.petDefault.skin

  graphic.ellipse(x + 64, y + 39, 24, 13).fill({
    color: lightenColor(petColor, 6),
    alpha: 0.95,
  })

  graphic.rect(x + 51, y + 27, 26, 18).fill(petColor)
  graphic.rect(x + 54, y + 24, 8, 7).fill(lightenColor(petColor, 5))
  graphic.rect(x + 67, y + 24, 8, 7).fill(lightenColor(petColor, 5))

  graphic.rect(x + 58, y + 32, 3, 2).fill(0x2f241f)
  graphic.rect(x + 68, y + 32, 3, 2).fill(0x2f241f)

  graphic.rect(x + 53, y + 45, 50, 8).fill({
    color: 0xfef3c7,
    alpha: 0.55,
  })
}