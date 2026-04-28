/**
 * 当前文件负责：渲染住所室内场景。
 */

import { Container, Graphics, Text, TextStyle } from "pixi.js"
import { shouldRenderInteriorNewbornNest } from "../actors/stage-pet-visibility"
import type { IncubatorState } from "@/types/incubator"
import type { PetState } from "@/types/pet"

import { STAGE_VISUAL_CONFIG } from "../../config/stage-visual-config"
import {
  darkenColor,
  lightenColor,
} from "../../shared/stage-renderer-utils"

export type DrawShelterInteriorInput = {
  backgroundLayer: Container | null
  terrainLayer: Container | null
  structureLayer: Container | null
  natureLayer: Container | null
  foregroundLayer: Container | null
  incubator: IncubatorState | null
  pet: PetState | null
  width: number
  height: number
}

export function drawShelterInterior(input: DrawShelterInteriorInput) {
  if (
    !input.backgroundLayer ||
    !input.terrainLayer ||
    !input.structureLayer ||
    !input.natureLayer ||
    !input.foregroundLayer
  ) {
    return
  }

  input.backgroundLayer.removeChildren()
  input.terrainLayer.removeChildren()
  input.structureLayer.removeChildren()
  input.natureLayer.removeChildren()
  input.foregroundLayer.removeChildren()

  drawInteriorBackground(input.backgroundLayer, input.width, input.height)
  drawInteriorFloor(input.terrainLayer, input.width, input.height)
  drawInteriorStructures(input.structureLayer, input.incubator, input.pet)
  drawInteriorForeground(input.foregroundLayer, input.width, input.height)
}

export function getShelterInteriorRenderKey(input: {
  incubator: IncubatorState | null
  pet: PetState | null
  width: number
  height: number
}): string {
  const progress = Math.round(input.incubator?.progress ?? 0)
  const stability = Math.round(input.incubator?.stability ?? 0)
  const petPhase = input.pet?.lifeState?.phase ?? "none"
  const petName = input.pet?.name ?? "none"

  return `shelter-interior-${input.width}-${input.height}-${progress}-${stability}-${petPhase}-${petName}`
}

function drawInteriorBackground(layer: Container, width: number, height: number) {
  const graphic = new Graphics()

  graphic.rect(0, 0, width, height).fill(0x1f2933)

  graphic.rect(56, 42, width - 112, height - 96).fill({
    color: 0x3b2f2a,
    alpha: 0.96,
  })

  graphic.rect(72, 58, width - 144, height - 128).fill({
    color: 0x4a382e,
    alpha: 0.98,
  })

  graphic.rect(72, 58, width - 144, 18).fill({
    color: 0x6b4b36,
    alpha: 0.48,
  })

  graphic.rect(72, height - 88, width - 144, 18).fill({
    color: 0x241916,
    alpha: 0.34,
  })

  drawWallPattern(graphic, width, height)

  layer.addChild(graphic)
}

function drawWallPattern(graphic: Graphics, width: number, height: number) {
  for (let x = 96; x < width - 96; x += 48) {
    graphic.rect(x, 86, 26, 3).fill({
      color: 0x7a5a40,
      alpha: 0.18,
    })
  }

  for (let y = 116; y < height - 130; y += 46) {
    graphic.rect(76, y, 8, 24).fill({
      color: 0x2f241f,
      alpha: 0.18,
    })

    graphic.rect(width - 84, y + 8, 8, 24).fill({
      color: 0x2f241f,
      alpha: 0.18,
    })
  }
}

function drawInteriorFloor(layer: Container, width: number, height: number) {
  const graphic = new Graphics()
  const floorTop = 260

  graphic.rect(78, floorTop, width - 156, height - floorTop - 88).fill({
    color: 0x6b4a32,
    alpha: 0.98,
  })

  for (let y = floorTop + 16; y < height - 96; y += 28) {
    graphic.rect(88, y, width - 176, 3).fill({
      color: 0x3b271c,
      alpha: 0.22,
    })

    graphic.rect(88, y + 12, width - 176, 1).fill({
      color: 0x9a6a45,
      alpha: 0.13,
    })
  }

  for (let x = 102; x < width - 110; x += 74) {
    graphic.rect(x, floorTop + 8, 3, height - floorTop - 108).fill({
      color: 0x3b271c,
      alpha: 0.13,
    })
  }

  layer.addChild(graphic)
}

function drawInteriorStructures(
  layer: Container,
  incubator: IncubatorState | null,
  pet: PetState | null
) {
  const graphic = new Graphics()

    drawInteriorDoor(graphic, 1080, 430)
    drawRestCorner(graphic, 190, 440)
    drawNewbornNest(graphic, 360, 470, incubator, pet)
    drawStorageShelf(graphic, 185, 150)
    drawIncubatorStation(graphic, 530, 285, incubator, pet)
    drawBirthRecordDesk(graphic, 720, 190, pet)

  layer.addChild(graphic)

  const title = new Text({
    text: "住所内部 · 初始生命舱",
    style: new TextStyle({
      fill: 0xf8fafc,
      fontSize: 15,
      fontWeight: "600",
    }),
  })

  title.x = 92
  title.y = 72
  layer.addChild(title)

  const hint = new Text({
    text: "孵化器是第一个宠物的生命起点；未来繁殖将进入独立的新生照护系统。",
    style: new TextStyle({
      fill: 0xcbd5e1,
      fontSize: 11,
    }),
  })

  hint.x = 92
  hint.y = 96
  layer.addChild(hint)
}

function drawInteriorDoor(graphic: Graphics, x: number, y: number) {
  graphic.rect(x, y, 78, 148).fill(0x2f1f18)
  graphic.rect(x + 8, y + 8, 62, 132).fill(0x5f3a24)
  graphic.rect(x + 16, y + 18, 46, 52).fill({
    color: 0x7a4a2a,
    alpha: 0.5,
  })
  graphic.rect(x + 16, y + 78, 46, 48).fill({
    color: 0x3b2418,
    alpha: 0.36,
  })
  graphic.circle(x + 58, y + 74, 4).fill(0xfacc15)

  graphic.rect(x - 18, y + 140, 116, 10).fill({
    color: 0x0f172a,
    alpha: 0.24,
  })
}

function drawRestCorner(graphic: Graphics, x: number, y: number) {
  graphic.rect(x - 18, y + 66, 172, 18).fill({
    color: 0x0f172a,
    alpha: 0.22,
  })

function drawNewbornNest(
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

  graphic.rect(x, y + 18, 128, 60).fill(0x6b4b36)
  graphic.rect(x + 10, y + 8, 104, 34).fill(0x93c5fd)
  graphic.rect(x + 16, y + 13, 38, 20).fill(0xdbeafe)
  graphic.rect(x + 68, y + 20, 40, 14).fill({
    color: 0x60a5fa,
    alpha: 0.54,
  })

  graphic.rect(x, y + 70, 12, 24).fill(0x3b271c)
  graphic.rect(x + 116, y + 70, 12, 24).fill(0x3b271c)
}

function drawStorageShelf(graphic: Graphics, x: number, y: number) {
  graphic.rect(x, y, 170, 18).fill(0x3b271c)
  graphic.rect(x + 8, y + 18, 154, 84).fill({
    color: 0x2f241f,
    alpha: 0.56,
  })

  for (let row = 0; row < 3; row += 1) {
    const shelfY = y + 30 + row * 24

    graphic.rect(x + 12, shelfY, 146, 5).fill(0x7a4a2a)

    for (let item = 0; item < 4; item += 1) {
      const itemX = x + 22 + item * 34

      graphic.rect(itemX, shelfY - 14, 13, 14).fill({
        color: row === 1 ? 0x38bdf8 : 0xfacc15,
        alpha: 0.45 + item * 0.08,
      })
    }
  }
}

function drawIncubatorStation(
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

function drawBirthRecordDesk(
  graphic: Graphics,
  x: number,
  y: number,
  pet: PetState | null
) {
  graphic.rect(x, y + 86, 180, 20).fill({
    color: 0x0f172a,
    alpha: 0.22,
  })

  graphic.rect(x, y + 30, 160, 64).fill(0x6b4b36)
  graphic.rect(x + 10, y + 40, 140, 34).fill({
    color: 0x3b271c,
    alpha: 0.42,
  })

  graphic.rect(x + 22, y, 86, 46).fill(0x1e293b)
  graphic.rect(x + 28, y + 6, 74, 34).fill({
    color: pet ? 0x38bdf8 : 0x64748b,
    alpha: pet ? 0.34 : 0.18,
  })

  graphic.rect(x + 116, y + 18, 24, 28).fill({
    color: 0xf8fafc,
    alpha: 0.7,
  })
  graphic.rect(x + 120, y + 24, 16, 2).fill(0x94a3b8)
  graphic.rect(x + 120, y + 31, 12, 2).fill(0x94a3b8)
  graphic.rect(x + 120, y + 38, 14, 2).fill(0x94a3b8)
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

function drawInteriorForeground(layer: Container, width: number, height: number) {
  const graphic = new Graphics()

  graphic.rect(0, 0, width, 38).fill({
    color: 0x020617,
    alpha: 0.22,
  })

  graphic.rect(0, height - 44, width, 44).fill({
    color: 0x020617,
    alpha: 0.18,
  })

  layer.addChild(graphic)
}

type IncubatorInteriorMode =
  | "active_hatching"
  | "empty_resting"
  | "birth_memory_capsule"

function resolveIncubatorInteriorMode(
  incubator: IncubatorState | null,
  pet: PetState | null
): IncubatorInteriorMode {
  const hasPetBorn = Boolean(pet)

  if (!hasPetBorn && incubator?.status !== "hatched") {
    return "active_hatching"
  }

  if (pet?.lifeState?.phase === "newborn" || pet?.lifeState?.phase === "adaptation") {
    return "empty_resting"
  }

  return "birth_memory_capsule"
}

function getIncubatorGlowColor(mode: IncubatorInteriorMode): number {
  if (mode === "active_hatching") return 0x67e8f9
  if (mode === "empty_resting") return 0x94a3b8

  return 0xfacc15
}