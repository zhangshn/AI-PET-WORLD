/**
 * 当前文件负责：渲染世界刺激的临时可视化提示。
 */

import { Container, Graphics, Text, TextStyle } from "pixi.js"

import type { WorldStimulus } from "@/ai/gateway"

export type StimulusVisualState = {
  container: Container
  label: Text
  baseX: number
  baseY: number
  type: string
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
  const activeStimuli = input.stimuli.slice(-8)
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
    const floating = Math.sin(input.phase * 2.4 + visual.baseX * 0.01) * 5

    visual.container.y = visual.baseY + floating
    visual.container.alpha = 0.72 + Math.sin(input.phase * 2) * 0.12
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
  const label = new Text({
    text: getStimulusLabel(stimulus),
    style: new TextStyle({
      fill: 0xf8fafc,
      fontSize: 10,
    }),
  })

  const position = getStimulusStagePosition(stimulus, tick)
  const color = getStimulusColor(stimulus.type)

  graphic.circle(0, 0, 8).fill({
    color,
    alpha: 0.64,
  })
  graphic.circle(0, 0, 18).stroke({
    color,
    alpha: 0.24,
    width: 2,
  })

  label.x = 12
  label.y = -8
  label.visible = false

  container.x = position.x
  container.y = position.y
  container.alpha = 0.82

  container.addChild(graphic)
  container.addChild(label)

  return {
    container,
    label,
    baseX: position.x,
    baseY: position.y,
    type: stimulus.type,
  }
}

function updateStimulusVisualPosition(
  visual: StimulusVisualState,
  tick: number
) {
  const offset = ((tick + visual.baseX + visual.baseY) % 12) - 6

  visual.container.x = visual.baseX + offset
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

function getStimulusLabel(stimulus: WorldStimulus): string {
  if (stimulus.type === "butterfly") return "蝴蝶掠过"
  if (stimulus.type === "breeze") return "微风"
  if (stimulus.type === "temperature_drop") return "气温变化"
  if (stimulus.type === "falling_leaf") return "落叶"
  if (stimulus.type === "light_shift") return "光影变化"

  return stimulus.type
}

function getStimulusColor(type: string): number {
  if (type === "butterfly") return 0xffd166
  if (type === "breeze") return 0x93c5fd
  if (type === "temperature_drop") return 0x38bdf8
  if (type === "falling_leaf") return 0x84cc16
  if (type === "light_shift") return 0xf8fafc

  return 0xffffff
}