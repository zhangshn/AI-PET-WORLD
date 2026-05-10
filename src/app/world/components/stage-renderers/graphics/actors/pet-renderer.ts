/**
 * 当前文件负责：渲染宠物角色的像素图形。
 */

import { Graphics } from "pixi.js"

import type { PetState } from "@/types/pet"

import { STAGE_VISUAL_CONFIG } from "../../config/stage-visual-config"
import { lightenColor } from "../../shared/stage-renderer-utils"
import { drawActorShadow } from "./actor-shape-utils"

type PetPose = {
  bodyX: number
  bodyY: number
  headX: number
  headY: number
  earOffsetY: number
  eyeOffsetX: number
  tailOffsetY: number
  bodyWidth: number
  bodyHeight: number
}

function getPetPose(pet: PetState | null, phase: number): PetPose {
  const action = pet?.action
  const breath = Math.sin(phase * 2.4) * 0.7
  const alert = Math.sin(phase * 4.2) * 0.8

  if (action === "observing") {
    return {
      bodyX: 0,
      bodyY: 5,
      headX: 5,
      headY: -1 + alert * 0.25,
      earOffsetY: -2,
      eyeOffsetX: 1,
      tailOffsetY: 0,
      bodyWidth: 23,
      bodyHeight: 15,
    }
  }

  if (action === "alert_idle") {
    return {
      bodyX: 0,
      bodyY: 4,
      headX: 4,
      headY: -3 + alert * 0.25,
      earOffsetY: -4,
      eyeOffsetX: 1,
      tailOffsetY: -2,
      bodyWidth: 22,
      bodyHeight: 15,
    }
  }

  if (action === "eating") {
    return {
      bodyX: 0,
      bodyY: 7,
      headX: 7,
      headY: 5,
      earOffsetY: 0,
      eyeOffsetX: 0,
      tailOffsetY: 1,
      bodyWidth: 23,
      bodyHeight: 14,
    }
  }

  if (action === "resting") {
    return {
      bodyX: 0,
      bodyY: 9 + breath * 0.2,
      headX: 4,
      headY: 5 + breath * 0.2,
      earOffsetY: 1,
      eyeOffsetX: 0,
      tailOffsetY: 1,
      bodyWidth: 25,
      bodyHeight: 12,
    }
  }

  if (action === "approaching") {
    return {
      bodyX: 0,
      bodyY: 5,
      headX: 3,
      headY: 0,
      earOffsetY: -1,
      eyeOffsetX: -1,
      tailOffsetY: Math.sin(phase * 7) * 1.2,
      bodyWidth: 22,
      bodyHeight: 15,
    }
  }

  if (action === "exploring" || action === "walking") {
    return {
      bodyX: 0,
      bodyY: 5,
      headX: 4,
      headY: -1,
      earOffsetY: -2,
      eyeOffsetX: 1,
      tailOffsetY: Math.sin(phase * 8) * 1.5,
      bodyWidth: 24,
      bodyHeight: 15,
    }
  }

  return {
    bodyX: 0,
    bodyY: 5 + breath * 0.25,
    headX: 3,
    headY: breath * 0.2,
    earOffsetY: 0,
    eyeOffsetX: 0,
    tailOffsetY: breath * 0.2,
    bodyWidth: 22,
    bodyHeight: 15,
  }
}

function drawPetIntentSignal(
  graphic: Graphics,
  pet: PetState | null,
  phase: number
) {
  if (!pet) return

  const pulse = 0.25 + Math.max(0, Math.sin(phase * 3.2)) * 0.22

  if (pet.currentGoal?.type === "expand_territory") {
    graphic.rect(25, 3, 7, 2).fill({
      color: STAGE_VISUAL_CONFIG.highlightColor,
      alpha: pulse,
    })
    graphic.rect(33, 0, 5, 2).fill({
      color: STAGE_VISUAL_CONFIG.highlightColor,
      alpha: pulse * 0.7,
    })
    return
  }

  if (pet.currentGoal?.type === "observe_boundary") {
    graphic.rect(24, 5, 4, 2).fill({
      color: STAGE_VISUAL_CONFIG.highlightColor,
      alpha: pulse,
    })
    graphic.rect(30, 2, 3, 2).fill({
      color: STAGE_VISUAL_CONFIG.highlightColor,
      alpha: pulse * 0.75,
    })
  }
}

function drawPetInterpretationAura(
  graphic: Graphics,
  pet: PetState | null,
  phase: number
) {
  if (!pet?.latestWorldInterpretation) return

  const interpretation = pet.latestWorldInterpretation
  const pulse = 0.16 + Math.max(0, Math.sin(phase * 2.6)) * 0.16
  const confidence = Math.max(0.18, Math.min(0.58, interpretation.confidence / 180))
  const alpha = Math.min(0.72, pulse + confidence)
  const color =
    interpretation.tone === "curious"
      ? 0x86efac
      : interpretation.tone === "careful"
        ? 0x93c5fd
        : interpretation.tone === "protective"
          ? 0xfde68a
          : 0xe2e8f0

  graphic.rect(-7, -9, 4, 4).fill({ color, alpha })
  graphic.rect(-12, -4, 3, 3).fill({ color, alpha: alpha * 0.58 })

  if (interpretation.posture === "observe_first") {
    graphic.rect(28, -7, 5, 2).fill({ color, alpha: alpha * 0.72 })
    graphic.rect(35, -10, 3, 2).fill({ color, alpha: alpha * 0.48 })
  }

  if (interpretation.posture === "explore_carefully") {
    graphic.rect(27, -4, 4, 4).fill({ color, alpha: alpha * 0.7 })
    graphic.rect(33, -1, 4, 4).fill({ color, alpha: alpha * 0.48 })
  }
}

function drawPetLifeLineMarker(
  graphic: Graphics,
  pet: PetState | null,
  phase: number
) {
  if (!pet?.latestLifeLineInfluence?.dominantFocus) return

  const focus = pet.latestLifeLineInfluence.dominantFocus
  const pulse = 0.2 + Math.max(0, Math.sin(phase * 1.8)) * 0.18
  const color =
    focus === "explore"
      ? 0x22c55e
      : focus === "observe" || focus === "perception"
        ? 0x60a5fa
        : focus === "recover"
          ? 0xa7f3d0
          : focus === "boundary" || focus === "protect"
            ? 0xfacc15
            : 0xe2e8f0

  graphic.rect(7, -13, 4, 3).fill({ color, alpha: pulse })
  graphic.rect(13, -15, 5, 3).fill({ color, alpha: pulse * 0.72 })
}

function drawPetStatusAccessory(
  graphic: Graphics,
  pet: PetState | null,
  phase: number
) {
  if (!pet) return

  const visual = STAGE_VISUAL_CONFIG.actor.petDefault

  if (pet.action === "observing") {
    graphic.rect(22, 5, 6, 2).fill({
      color: STAGE_VISUAL_CONFIG.highlightColor,
      alpha: 0.38,
    })
    return
  }

  if (pet.action === "alert_idle") {
    graphic.rect(20, -5, 4, 3).fill({
      color: 0xfacc15,
      alpha: 0.58,
    })
    graphic.rect(25, -8, 3, 3).fill({
      color: 0xfacc15,
      alpha: 0.34,
    })
    return
  }

  if (pet.action === "eating") {
    graphic.rect(23, 16, 6, 4).fill(visual.cloth)
    graphic.rect(25, 12, 2, 4).fill(0x22c55e)
    graphic.rect(20, 18, 3, 2).fill(0xfacc15)
    return
  }

  if (pet.action === "resting") {
    graphic.rect(25, 8, 8, 3).fill({
      color: 0xa7f3d0,
      alpha: 0.45,
    })
    return
  }

  if (pet.action === "approaching") {
    graphic.rect(-6, 9, 4, 3).fill({
      color: 0xfde68a,
      alpha: 0.42 + Math.sin(phase * 5) * 0.08,
    })
  }
}

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
  const step = moving ? Math.sin(phase * 7) * 1.7 : 0
  const pose = getPetPose(pet, phase)

  drawPetInterpretationAura(graphic, pet, phase)
  drawPetLifeLineMarker(graphic, pet, phase)

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

  graphic.rect(
    pose.bodyX,
    pose.bodyY,
    pose.bodyWidth,
    pose.bodyHeight
  ).fill(color)
  graphic.rect(
    pose.headX,
    pose.headY,
    16,
    pet?.action === "resting" ? 8 : 9
  ).fill(lightenColor(color, 8))

  graphic.rect(
    pose.headX - 1,
    pose.headY - 3 + pose.earOffsetY,
    5,
    5
  ).fill(lightenColor(color, 5))
  graphic.rect(
    pose.headX + 13,
    pose.headY - 3 + pose.earOffsetY,
    5,
    5
  ).fill(lightenColor(color, 5))

  if (blink || pet?.action === "resting") {
    graphic.rect(pose.headX + 2, pose.headY + 4, 4, 1).fill(visual.dark)
    graphic.rect(pose.headX + 11, pose.headY + 4, 4, 1).fill(visual.dark)
  } else {
    graphic.rect(
      pose.headX + 3 + pose.eyeOffsetX,
      pose.headY + 3,
      3,
      3
    ).fill(visual.dark)
    graphic.rect(
      pose.headX + 11 + pose.eyeOffsetX,
      pose.headY + 3,
      3,
      3
    ).fill(visual.dark)
    graphic.rect(
      pose.headX + 4 + pose.eyeOffsetX,
      pose.headY + 3,
      1,
      1
    ).fill(STAGE_VISUAL_CONFIG.highlightColor)
    graphic.rect(
      pose.headX + 12 + pose.eyeOffsetX,
      pose.headY + 3,
      1,
      1
    ).fill(STAGE_VISUAL_CONFIG.highlightColor)
  }

  graphic.rect(pose.headX + 7, pose.headY + 8, 3, 2).fill({
    color: visual.skinShadow,
    alpha: 0.45,
  })

  graphic.rect(-3, pose.bodyY + 8 + pose.tailOffsetY, 5, 4).fill(
    lightenColor(color, 4)
  )

  graphic.rect(2, 19, 5, 5 + Math.max(0, step)).fill(visual.dark)
  graphic.rect(15, 19, 5, 5 + Math.max(0, -step)).fill(visual.dark)

  drawPetStatusAccessory(graphic, pet, phase)
  drawPetIntentSignal(graphic, pet, phase)
}

export function getPetBob(action?: string, phase = 0): number {
  if (action === "sleeping") return Math.sin(phase * 1.6) * 0.45
  if (action === "resting") return Math.sin(phase * 1.8) * 0.35
  if (action === "exploring") return Math.sin(phase * 6.5) * 2.2
  if (action === "walking") return Math.sin(phase * 6) * 1.8
  if (action === "alert_idle") return Math.sin(phase * 4.2) * 0.55
  if (action === "observing") return Math.sin(phase * 2.2) * 0.5

  return Math.sin(phase * 3) * 0.8
}

function getPetColor(pet: PetState | null): number {
  const visual = STAGE_VISUAL_CONFIG.actor.petDefault

  if (!pet) return visual.skin
  if (pet.action === "sleeping") return 0x94a3b8
  if (pet.action === "eating") return visual.cloth
  if (pet.action === "resting") return 0xa7f3d0
  if (pet.action === "alert_idle") return 0xfbbf24
  if (pet.currentGoal?.type === "expand_territory") return 0x86efac
  if (pet.currentGoal?.type === "observe_boundary") return 0x93c5fd
  if (pet.mood === "happy") return visual.cloth
  if (pet.mood === "alert") return 0xef4444
  if (pet.mood === "curious") return 0x22c55e

  return visual.skin
}