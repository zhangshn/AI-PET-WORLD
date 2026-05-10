/**
 * 当前文件负责：绘制玩家点击后的短暂像素反馈。
 *
 * 注意：
 * 这里只做前端表现，不改变世界后台状态。
 */

import { Container, Graphics } from "pixi.js"

export type StageClickFeedbackKind =
  | "shelter_entry"
  | "shelter_exit"
  | "garden_observe"
  | "incubator_focus"

export type StageClickFeedback = {
  id: string
  kind: StageClickFeedbackKind
  x: number
  y: number
  createdAtMs: number
  durationMs: number
}

export function createStageClickFeedback(input: {
  kind: StageClickFeedbackKind
  x: number
  y: number
  nowMs: number
}): StageClickFeedback {
  return {
    id: `${input.kind}-${Math.round(input.nowMs)}-${Math.round(input.x)}-${Math.round(input.y)}`,
    kind: input.kind,
    x: input.x,
    y: input.y,
    createdAtMs: input.nowMs,
    durationMs: resolveFeedbackDuration(input.kind),
  }
}

export function syncStageClickFeedbacks(input: {
  layer: Container | null
  feedbacks: StageClickFeedback[]
  nowMs: number
}) {
  if (!input.layer) return

  input.layer.removeChildren()

  const activeFeedbacks = input.feedbacks.filter(
    (feedback) => input.nowMs - feedback.createdAtMs <= feedback.durationMs
  )

  input.feedbacks.splice(0, input.feedbacks.length, ...activeFeedbacks)

  if (activeFeedbacks.length === 0) return

  const graphic = new Graphics()

  activeFeedbacks.forEach((feedback) => {
    drawFeedback(graphic, {
      feedback,
      ageMs: input.nowMs - feedback.createdAtMs,
    })
  })

  input.layer.addChild(graphic)
}

function resolveFeedbackDuration(kind: StageClickFeedbackKind): number {
  if (kind === "garden_observe") return 520
  if (kind === "incubator_focus") return 620

  return 460
}

function drawFeedback(
  graphic: Graphics,
  input: {
    feedback: StageClickFeedback
    ageMs: number
  }
) {
  const progress = Math.max(
    0,
    Math.min(1, input.ageMs / input.feedback.durationMs)
  )
  const alpha = 1 - progress

  if (input.feedback.kind === "garden_observe") {
    drawGardenSparkle(graphic, input.feedback.x, input.feedback.y, alpha, progress)
    return
  }

  if (input.feedback.kind === "incubator_focus") {
    drawIncubatorGlow(graphic, input.feedback.x, input.feedback.y, alpha, progress)
    return
  }

  drawPixelRipple(graphic, input.feedback.x, input.feedback.y, alpha, progress)
}

function drawPixelRipple(
  graphic: Graphics,
  x: number,
  y: number,
  alpha: number,
  progress: number
) {
  const radius = 8 + progress * 22
  const color = 0xfde68a

  graphic.rect(x - radius, y - 2, radius * 2, 4).fill({
    color,
    alpha: alpha * 0.38,
  })
  graphic.rect(x - 2, y - radius, 4, radius * 2).fill({
    color,
    alpha: alpha * 0.3,
  })
  graphic.rect(x - 7, y - 7, 14, 14).stroke({
    color,
    alpha: alpha * 0.9,
    width: 2,
  })
  graphic.rect(x - radius * 0.62, y - radius * 0.62, radius * 1.24, radius * 1.24).stroke({
    color: 0x93c5fd,
    alpha: alpha * 0.34,
    width: 2,
  })
}

function drawGardenSparkle(
  graphic: Graphics,
  x: number,
  y: number,
  alpha: number,
  progress: number
) {
  const spread = 8 + progress * 14

  drawPixelSpark(graphic, x, y, 0x86efac, alpha)
  drawPixelSpark(graphic, x - spread, y + 5, 0xfde68a, alpha * 0.72)
  drawPixelSpark(graphic, x + spread, y - 4, 0xa7f3d0, alpha * 0.66)
  graphic.rect(x - 18, y + 10, 36, 3).fill({
    color: 0x86efac,
    alpha: alpha * 0.26,
  })
}

function drawIncubatorGlow(
  graphic: Graphics,
  x: number,
  y: number,
  alpha: number,
  progress: number
) {
  const height = 22 + progress * 10

  graphic.rect(x - 18, y - height, 36, height).fill({
    color: 0xa7f3d0,
    alpha: alpha * 0.16,
  })
  graphic.rect(x - 12, y - height + 5, 24, 4).fill({
    color: 0xfde68a,
    alpha: alpha * 0.72,
  })
  graphic.rect(x - 15, y - 7, 30, 5).fill({
    color: 0x86efac,
    alpha: alpha * 0.58,
  })
  drawPixelSpark(graphic, x, y - height, 0xfde68a, alpha)
}

function drawPixelSpark(
  graphic: Graphics,
  x: number,
  y: number,
  color: number,
  alpha: number
) {
  graphic.rect(x - 2, y - 8, 4, 16).fill({ color, alpha })
  graphic.rect(x - 8, y - 2, 16, 4).fill({ color, alpha })
  graphic.rect(x - 3, y - 3, 6, 6).fill({ color: 0xffffff, alpha: alpha * 0.82 })
}
