/**
 * 当前文件负责：渲染管家角色的像素图形。
 */

import { Graphics } from "pixi.js"

import type { ButlerState } from "@/types/butler"

import { STAGE_VISUAL_CONFIG } from "../../config/stage-visual-config"
import { darkenColor } from "../../shared/stage-renderer-utils"
import { drawActorShadow } from "./actor-shape-utils"

type ButlerPose = {
  bodyLean: number
  headY: number
  leftArmY: number
  rightArmY: number
  leftArmX: number
  rightArmX: number
  toolAlpha: number
  signalAlpha: number
}

function getButlerPose(
  butler: ButlerState | null,
  phase: number
): ButlerPose {
  const task = butler?.task
  const workPulse = Math.sin(phase * 5.5)
  const calmPulse = Math.sin(phase * 2.2)

  if (task === "watching_incubator") {
    return {
      bodyLean: -1,
      headY: calmPulse * 0.35,
      leftArmY: 17,
      rightArmY: 13 + workPulse * 1.2,
      leftArmX: -5,
      rightArmX: 17,
      toolAlpha: 0.35,
      signalAlpha: 0.32,
    }
  }

  if (task === "building_home") {
    return {
      bodyLean: 1,
      headY: workPulse * 0.55,
      leftArmY: 15 + workPulse * 1.4,
      rightArmY: 16 - workPulse * 1.4,
      leftArmX: -4,
      rightArmX: 18,
      toolAlpha: 1,
      signalAlpha: 0.18,
    }
  }

  if (task === "offering_food") {
    return {
      bodyLean: 1,
      headY: calmPulse * 0.3,
      leftArmY: 16,
      rightArmY: 18,
      leftArmX: -5,
      rightArmX: 19,
      toolAlpha: 0.55,
      signalAlpha: 0.35,
    }
  }

  if (task === "offering_rest") {
    return {
      bodyLean: 0,
      headY: calmPulse * 0.2,
      leftArmY: 18,
      rightArmY: 18,
      leftArmX: -5,
      rightArmX: 18,
      toolAlpha: 0.15,
      signalAlpha: 0.42,
    }
  }

  if (task === "offering_approach") {
    return {
      bodyLean: -1,
      headY: calmPulse * 0.25,
      leftArmY: 15,
      rightArmY: 14 + Math.sin(phase * 4.5) * 0.8,
      leftArmX: -6,
      rightArmX: 18,
      toolAlpha: 0.1,
      signalAlpha: 0.5,
    }
  }

  if (task === "watching_pet") {
    return {
      bodyLean: -1,
      headY: calmPulse * 0.25,
      leftArmY: 18,
      rightArmY: 17,
      leftArmX: -5,
      rightArmX: 17,
      toolAlpha: 0.1,
      signalAlpha: 0.4,
    }
  }

  return {
    bodyLean: 0,
    headY: calmPulse * 0.25,
    leftArmY: 17,
    rightArmY: 17,
    leftArmX: -4,
    rightArmX: 17,
    toolAlpha: 0,
    signalAlpha: 0.18,
  }
}

function drawButlerTaskAccessory(
  graphic: Graphics,
  butler: ButlerState | null,
  phase: number,
  bodyY: number,
  pose: ButlerPose
) {
  const task = butler?.task
  const pulse = 0.25 + Math.max(0, Math.sin(phase * 3)) * 0.2

  if (task === "building_home") {
    graphic.rect(20, bodyY + 22, 11, 4).fill(0x8b5a2b)
    graphic.rect(28, bodyY + 17, 5, 12).fill(0x6b3f1d)
    graphic.rect(24, bodyY + 14, 3, 4).fill({
      color: 0xfacc15,
      alpha: pose.toolAlpha,
    })
    return
  }

  if (task === "watching_incubator") {
    graphic.rect(21, bodyY + 18, 6, 8).fill({
      color: STAGE_VISUAL_CONFIG.highlightColor,
      alpha: 0.32 + pulse * 0.4,
    })
    graphic.rect(28, bodyY + 15, 3, 3).fill({
      color: 0xa7f3d0,
      alpha: 0.32,
    })
    return
  }

  if (task === "offering_food") {
    graphic.rect(21, bodyY + 25, 9, 4).fill(0x8b5a2b)
    graphic.rect(23, bodyY + 22, 3, 3).fill(0x22c55e)
    graphic.rect(27, bodyY + 22, 3, 3).fill(0xfacc15)
    return
  }

  if (task === "offering_rest") {
    graphic.rect(21, bodyY + 25, 11, 4).fill({
      color: 0xa7f3d0,
      alpha: 0.45,
    })
    graphic.rect(24, bodyY + 20, 4, 3).fill({
      color: STAGE_VISUAL_CONFIG.highlightColor,
      alpha: 0.28,
    })
    return
  }

  if (task === "offering_approach") {
    graphic.rect(22, bodyY + 13, 4, 3).fill({
      color: 0xfde68a,
      alpha: 0.45 + pulse * 0.3,
    })
    graphic.rect(28, bodyY + 10, 3, 3).fill({
      color: 0xfde68a,
      alpha: 0.25 + pulse * 0.2,
    })
    return
  }

  if (task === "watching_pet") {
    graphic.rect(21, bodyY + 8, 5, 2).fill({
      color: STAGE_VISUAL_CONFIG.highlightColor,
      alpha: 0.28 + pulse,
    })
    graphic.rect(28, bodyY + 6, 3, 2).fill({
      color: STAGE_VISUAL_CONFIG.highlightColor,
      alpha: 0.18 + pulse * 0.5,
    })
  }
}

export function drawButlerGraphic(
  graphic: Graphics,
  butler: ButlerState | null,
  phase: number
) {
  graphic.clear()

  const visual = STAGE_VISUAL_CONFIG.actor.butler
  const pose = getButlerPose(butler, phase)
  const task = butler?.task
  const working = task === "watching_incubator" || task === "building_home"
  const bob = working
    ? Math.sin(phase * 5.5) * 1.1
    : Math.sin(phase * 2.5) * 0.45

  drawActorShadow(graphic, 9, 67, 15, 5, 0.22)

  const bodyY = bob
  const bodyX = pose.bodyLean

  graphic.rect(3 + bodyX, bodyY + pose.headY, 12, 10).fill(visual.skin)
  graphic.rect(5 + bodyX, bodyY + 2 + pose.headY, 3, 2).fill(visual.outline)
  graphic.rect(11 + bodyX, bodyY + 2 + pose.headY, 3, 2).fill(visual.outline)
  graphic.rect(7 + bodyX, bodyY + 7 + pose.headY, 5, 2).fill({
    color: visual.skinShadow,
    alpha: 0.42,
  })

  graphic.rect(0 + bodyX, bodyY + 10, 18, 28).fill(
    darkenColor(visual.cloth, 24)
  )
  graphic.rect(3 + bodyX, bodyY + 12, 12, 22).fill(visual.cloth)
  graphic.rect(6 + bodyX, bodyY + 10, 6, 28).fill({
    color: visual.clothLight,
    alpha: 0.22,
  })

  graphic.rect(pose.leftArmX + bodyX, bodyY + pose.leftArmY, 5, 19).fill(
    visual.skin
  )
  graphic.rect(pose.rightArmX + bodyX, bodyY + pose.rightArmY, 5, 19).fill(
    visual.skin
  )

  drawButlerTaskAccessory(graphic, butler, phase, bodyY, pose)

  graphic.rect(3 + bodyX, bodyY + 38, 5, 22).fill(darkenColor(visual.dark, 6))
  graphic.rect(11 + bodyX, bodyY + 38, 5, 22).fill(darkenColor(visual.dark, 6))

  graphic.rect(1 + bodyX, bodyY + 60, 8, 4).fill(visual.dark)
  graphic.rect(10 + bodyX, bodyY + 60, 8, 4).fill(visual.dark)

  graphic.rect(2 + bodyX, bodyY - 4 + pose.headY, 14, 4).fill(0x3f2a18)
  graphic.rect(0 + bodyX, bodyY - 1 + pose.headY, 18, 3).fill(0x5a3b22)

  if (pose.signalAlpha > 0) {
    graphic.rect(-7, bodyY + 5, 3, 3).fill({
      color: STAGE_VISUAL_CONFIG.highlightColor,
      alpha: pose.signalAlpha,
    })
  }
}