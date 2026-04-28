/**
 * 当前文件负责：渲染世界刺激的自然化可视线索。
 */

import { Container, Graphics } from "pixi.js"

import type { WorldStimulus } from "@/ai/gateway"

import { STAGE_VISUAL_CONFIG } from "./stage-visual-config"
import {
  darkenColor,
  lightenColor,
} from "./stage-renderer-utils"

export type StimulusVisualState = {
  container: Container
  graphic: Graphics
  baseX: number
  baseY: number
  type: string
  seed: number
}

export type StimulusVisualRegistry = Map<string, StimulusVisualState>

export type SyncStimulusVisualsInput = {
  layer: Container
  stimuli: WorldStimulus[]
  visuals: StimulusVisualRegistry
  tick: number
}

export function createStimulusVisualRegistry(): StimulusVisualRegistry {
  return new Map<string, StimulusVisualState>()
}

export function syncStimulusVisuals(input: SyncStimulusVisualsInput) {
  const activeStimuli = input.stimuli.slice(-7)
  const activeIds = new Set(activeStimuli.map((stimulus) => stimulus.id))

  for (const [stimulusId, visual] of input.visuals.entries()) {
    if (!activeIds.has(stimulusId)) {
      visual.container.destroy({ children: true })
      input.visuals.delete(stimulusId)
    }
  }

  for (const stimulus of activeStimuli) {
    const existing = input.visuals.get(stimulus.id)

    if (existing) {
      updateStimulusVisualPosition(existing, input.tick)
      redrawStimulusGraphic(existing.graphic, existing.type, existing.seed)
      continue
    }

    const visual = createStimulusVisual(stimulus, input.tick)

    input.layer.addChild(visual.container)
    input.visuals.set(stimulus.id, visual)
  }
}

export function animateStimulusVisuals(input: {
  visuals: StimulusVisualRegistry
  phase: number
}) {
  for (const visual of input.visuals.values()) {
    const floating = Math.sin(input.phase * 2.2 + visual.seed * 0.03) * 3
    const swaying = Math.cos(input.phase * 1.4 + visual.seed * 0.02) * 2

    visual.container.x = visual.baseX + swaying
    visual.container.y = visual.baseY + floating
    visual.container.alpha = 0.5 + Math.sin(input.phase * 1.6 + visual.seed) * 0.12
  }
}

export function clearStimulusVisuals(visuals: StimulusVisualRegistry) {
  for (const visual of visuals.values()) {
    visual.container.destroy({ children: true })
  }

  visuals.clear()
}

function createStimulusVisual(
  stimulus: WorldStimulus,
  tick: number
): StimulusVisualState {
  const container = new Container()
  const graphic = new Graphics()
  const position = getStimulusStagePosition(stimulus, tick)
  const seed = createStableStimulusSeed(stimulus.id, stimulus.type, tick)

  redrawStimulusGraphic(graphic, stimulus.type, seed)

  container.x = position.x
  container.y = position.y
  container.alpha = 0.64

  container.addChild(graphic)

  return {
    container,
    graphic,
    baseX: position.x,
    baseY: position.y,
    type: stimulus.type,
    seed,
  }
}

function updateStimulusVisualPosition(
  visual: StimulusVisualState,
  tick: number
) {
  const offset = ((tick + visual.seed) % 8) - 4

  visual.baseX += offset * 0.08
}

function redrawStimulusGraphic(
  graphic: Graphics,
  type: string,
  seed: number
) {
  graphic.clear()

  if (type === "butterfly") {
    drawButterflyTrace(graphic, seed)
    return
  }

  if (type === "breeze") {
    drawBreezeTrace(graphic, seed)
    return
  }

  if (type === "temperature_drop") {
    drawTemperatureTrace(graphic, seed)
    return
  }

  if (type === "falling_leaf") {
    drawFallingLeafTrace(graphic, seed)
    return
  }

  if (type === "light_shift") {
    drawLightShiftTrace(graphic, seed)
    return
  }

  drawGenericWorldTrace(graphic, seed)
}

function drawButterflyTrace(graphic: Graphics, seed: number) {
  const visual = STAGE_VISUAL_CONFIG.entity.butterfly
  const color = visual.wings[seed % visual.wings.length]
  const light = visual.wingLights[seed % visual.wingLights.length]

  graphic.rect(-6, -4, 5, 5).fill({
    color,
    alpha: 0.72,
  })

  graphic.rect(1, -4, 5, 5).fill({
    color: lightenColor(color, 12),
    alpha: 0.72,
  })

  graphic.rect(-1, -3, 2, 7).fill({
    color: visual.body,
    alpha: 0.65,
  })

  graphic.rect(-10, 5, 3, 2).fill({
    color: light,
    alpha: 0.42,
  })

  graphic.rect(8, 4, 3, 2).fill({
    color: light,
    alpha: 0.36,
  })
}

function drawBreezeTrace(graphic: Graphics, seed: number) {
  const widthA = 16 + (seed % 8)
  const widthB = 10 + (seed % 6)
  const color = STAGE_VISUAL_CONFIG.effect.breeze

  graphic.rect(-widthA / 2, -4, widthA, 2).fill({
    color,
    alpha: 0.34,
  })

  graphic.rect(-widthB / 2 + 4, 3, widthB, 2).fill({
    color: darkenColor(color, 18),
    alpha: 0.26,
  })

  graphic.rect(-2, -1, 4, 1).fill({
    color: STAGE_VISUAL_CONFIG.highlightColor,
    alpha: 0.28,
  })
}

function drawTemperatureTrace(graphic: Graphics, seed: number) {
  const height = 10 + (seed % 6)
  const color = STAGE_VISUAL_CONFIG.effect.coldLight

  graphic.rect(-2, -height, 4, height).fill({
    color,
    alpha: 0.28,
  })

  graphic.rect(-5, -height + 2, 2, 4).fill({
    color: lightenColor(color, 35),
    alpha: 0.36,
  })

  graphic.rect(4, -height + 5, 2, 4).fill({
    color: lightenColor(color, 18),
    alpha: 0.28,
  })
}

function drawFallingLeafTrace(graphic: Graphics, seed: number) {
  const base = STAGE_VISUAL_CONFIG.effect.leaf
  const color = seed % 2 === 0 ? base : lightenColor(base, 18)

  graphic.rect(-3, -5, 7, 4).fill({
    color,
    alpha: 0.78,
  })

  graphic.rect(-1, -1, 3, 6).fill({
    color: darkenColor(base, 28),
    alpha: 0.44,
  })

  graphic.rect(5, 4, 5, 2).fill({
    color: lightenColor(base, 36),
    alpha: 0.22,
  })
}

function drawLightShiftTrace(graphic: Graphics, seed: number) {
  const size = 3 + (seed % 3)
  const color = STAGE_VISUAL_CONFIG.effect.sparkle

  graphic.rect(-size, -size, size * 2, size * 2).fill({
    color,
    alpha: 0.34,
  })

  graphic.rect(-1, -9, 2, 18).fill({
    color: STAGE_VISUAL_CONFIG.highlightColor,
    alpha: 0.16,
  })

  graphic.rect(-9, -1, 18, 2).fill({
    color: STAGE_VISUAL_CONFIG.highlightColor,
    alpha: 0.16,
  })
}

function drawGenericWorldTrace(graphic: Graphics, seed: number) {
  const color =
    seed % 2 === 0
      ? STAGE_VISUAL_CONFIG.effect.warmLight
      : lightenColor(STAGE_VISUAL_CONFIG.effect.leaf, 30)

  graphic.rect(-3, -3, 6, 6).fill({
    color,
    alpha: 0.5,
  })

  graphic.rect(-7, 4, 3, 2).fill({
    color,
    alpha: 0.28,
  })

  graphic.rect(5, -6, 2, 3).fill({
    color,
    alpha: 0.24,
  })
}

function getStimulusStagePosition(
  stimulus: WorldStimulus,
  tick: number
): { x: number; y: number } {
  const seed = createStableStimulusSeed(stimulus.id, stimulus.type, tick)

  return {
    x: 240 + (seed % 760),
    y: 180 + ((seed * 7) % 360),
  }
}

function createStableStimulusSeed(
  id: string,
  type: string,
  tick: number
): number {
  let seed = tick * 13 + type.length * 29

  for (let index = 0; index < id.length; index += 1) {
    seed += id.charCodeAt(index) * (index + 1)
  }

  return Math.abs(seed)
}

