/**
 * 当前文件负责：根据世界生态状态生成刺激、清理过期刺激，并推进刺激在世界空间中的位置变化。
 */

import { createWorldStimulus } from "./stimulus-builder"

import type {
  BuildWorldStimuliInput,
  WorldStimulus,
  WorldStimulusSystemState,
} from "./stimulus-types"
import type { WorldZoneType } from "@/world/ecology/world-zone-types"

const ROOM_MIN_X = 60
const ROOM_MAX_X = 900
const ROOM_MIN_Y = 80
const ROOM_MAX_Y = 430

function randomChance(rate: number): boolean {
  return Math.random() < rate
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function filterExpiredStimuli(
  stimuli: WorldStimulus[],
  tick: number
): WorldStimulus[] {
  return stimuli.filter((item) => item.expiresAtTick >= tick)
}

function hasActiveStimulus(
  stimuli: WorldStimulus[],
  type: WorldStimulus["type"]
): boolean {
  return stimuli.some((item) => item.type === type)
}

function findZone(input: BuildWorldStimuliInput, type: WorldZoneType) {
  return input.ecology.zones.find((zone) => zone.type === type && zone.isActive)
}

function updateStimulusSpatialState(
  stimulus: WorldStimulus,
  tick: number
): WorldStimulus {
  const phase = stimulus.movementPhase + 0.35

  if (stimulus.movementPattern === "static") {
    return {
      ...stimulus,
      movementPhase: phase,
    }
  }

  if (stimulus.movementPattern === "floating") {
    return {
      ...stimulus,
      worldPosition: {
        x: clamp(
          stimulus.worldPosition.x + Math.sin(phase) * 1.2,
          ROOM_MIN_X,
          ROOM_MAX_X
        ),
        y: clamp(
          stimulus.worldPosition.y + Math.cos(phase * 0.8) * 0.8,
          ROOM_MIN_Y,
          ROOM_MAX_Y
        ),
      },
      movementPhase: phase,
    }
  }

  if (stimulus.movementPattern === "drifting") {
    const direction = stimulus.type === "falling_leaf" ? 1 : 0.35

    return {
      ...stimulus,
      worldPosition: {
        x: clamp(
          stimulus.worldPosition.x + Math.sin(phase * 0.9) * 4,
          ROOM_MIN_X,
          ROOM_MAX_X
        ),
        y: clamp(
          stimulus.worldPosition.y + direction * 3,
          ROOM_MIN_Y,
          ROOM_MAX_Y
        ),
      },
      movementPhase: phase,
    }
  }

  if (stimulus.movementPattern === "wandering") {
    return {
      ...stimulus,
      worldPosition: {
        x: clamp(
          stimulus.worldPosition.x + Math.sin(tick * 0.65 + phase) * 7,
          ROOM_MIN_X,
          ROOM_MAX_X
        ),
        y: clamp(
          stimulus.worldPosition.y + Math.cos(tick * 0.8 + phase) * 5,
          ROOM_MIN_Y,
          ROOM_MAX_Y
        ),
      },
      movementPhase: phase,
    }
  }

  return {
    ...stimulus,
    movementPhase: phase,
  }
}

function buildEcologyDrivenStimuli(
  input: BuildWorldStimuliInput
): WorldStimulus[] {
  const { tick, time, ecology, existingStimuli } = input
  const environment = ecology.environment
  const results: WorldStimulus[] = []

  if (
    environment.windLevel >= 38 &&
    !hasActiveStimulus(existingStimuli, "breeze") &&
    randomChance(environment.windLevel >= 65 ? 0.45 : 0.28)
  ) {
    results.push(
      createWorldStimulus({
        type: "breeze",
        category: "environment",
        tick,
        day: time.day,
        hour: time.hour,
        period: time.period,
        intensity: environment.windLevel >= 70 ? "high" : "medium",
        durationTick: 2,
        summary: "空气里掠过一阵持续流动的风。",
        tags: ["wind", "air", "movement"],
      })
    )
  }

  if (
    environment.lightLevel >= 58 &&
    !hasActiveStimulus(existingStimuli, "light_shift") &&
    randomChance(0.22)
  ) {
    results.push(
      createWorldStimulus({
        type: "light_shift",
        category: "environment",
        tick,
        day: time.day,
        hour: time.hour,
        period: time.period,
        intensity: "low",
        durationTick: 1,
        summary: "周围的光影似乎产生了一点变化。",
        tags: ["light", "visual", "environment"],
      })
    )
  }

  if (
    environment.temperature <= 12 &&
    !hasActiveStimulus(existingStimuli, "temperature_drop") &&
    randomChance(0.24)
  ) {
    results.push(
      createWorldStimulus({
        type: "temperature_drop",
        category: "environment",
        tick,
        day: time.day,
        hour: time.hour,
        period: time.period,
        intensity: "medium",
        durationTick: 3,
        summary: "周围温度明显下降了一些。",
        tags: ["cold", "temperature", "body"],
      })
    )
  }

  if (
    environment.lightLevel <= 28 &&
    !hasActiveStimulus(existingStimuli, "shadow_motion") &&
    randomChance(environment.stability <= 45 ? 0.24 : 0.14)
  ) {
    results.push(
      createWorldStimulus({
        type: "shadow_motion",
        category: "dynamic",
        tick,
        day: time.day,
        hour: time.hour,
        period: time.period,
        intensity: environment.stability <= 45 ? "high" : "medium",
        durationTick: 1,
        summary: "视线边缘似乎有阴影轻微移动。",
        tags: ["shadow", "night", "uncertain"],
      })
    )
  }

  const quietZone = findZone(input, "quiet_zone")

  if (
    quietZone &&
    environment.lightLevel <= 36 &&
    environment.windLevel <= 42 &&
    !hasActiveStimulus(existingStimuli, "quiet_zone") &&
    randomChance(0.24)
  ) {
    results.push(
      createWorldStimulus({
        type: "quiet_zone",
        category: "spatial",
        tick,
        day: time.day,
        hour: time.hour,
        period: time.period,
        intensity: "low",
        durationTick: 3,
        summary: "附近有一小片区域显得格外安静。",
        tags: ["quiet", "rest", "observation"],
        worldPosition: {
          x: quietZone.x,
          y: quietZone.y,
        },
        spatialRadius: quietZone.radius,
      })
    )
  }

  const warmZone = findZone(input, "warm_zone")

  if (
    warmZone &&
    environment.temperature >= 24 &&
    environment.lightLevel >= 45 &&
    !hasActiveStimulus(existingStimuli, "warm_zone") &&
    randomChance(0.22)
  ) {
    results.push(
      createWorldStimulus({
        type: "warm_zone",
        category: "spatial",
        tick,
        day: time.day,
        hour: time.hour,
        period: time.period,
        intensity: "medium",
        durationTick: 3,
        summary: "某个角落比周围更温暖一些。",
        tags: ["comfort", "warm", "safe"],
        worldPosition: {
          x: warmZone.x,
          y: warmZone.y,
        },
        spatialRadius: warmZone.radius,
      })
    )
  }

  if (
    environment.lightLevel >= 55 &&
    environment.temperature >= 18 &&
    environment.temperature <= 30 &&
    environment.windLevel <= 55 &&
    !hasActiveStimulus(existingStimuli, "butterfly") &&
    randomChance(0.18)
  ) {
    results.push(
      createWorldStimulus({
        type: "butterfly",
        category: "dynamic",
        tick,
        day: time.day,
        hour: time.hour,
        period: time.period,
        intensity: "medium",
        durationTick: 2,
        summary: "一只轻快的小蝴蝶从附近掠过。",
        tags: ["curiosity", "moving_target", "chaseable"],
      })
    )
  }

  if (
    environment.windLevel >= 30 &&
    !hasActiveStimulus(existingStimuli, "falling_leaf") &&
    randomChance(environment.windLevel >= 60 ? 0.26 : 0.16)
  ) {
    results.push(
      createWorldStimulus({
        type: "falling_leaf",
        category: "dynamic",
        tick,
        day: time.day,
        hour: time.hour,
        period: time.period,
        intensity: "low",
        durationTick: 1,
        summary: "一片叶子在风里缓慢飘落。",
        tags: ["visual", "wind", "moving_target"],
      })
    )
  }

  if (
    environment.stability <= 55 &&
    !hasActiveStimulus(existingStimuli, "distant_sound") &&
    randomChance(0.18)
  ) {
    results.push(
      createWorldStimulus({
        type: "distant_sound",
        category: "dynamic",
        tick,
        day: time.day,
        hour: time.hour,
        period: time.period,
        intensity: "medium",
        durationTick: 1,
        summary: "远处传来了一点不太清晰的动静。",
        tags: ["sound", "attention", "unknown"],
      })
    )
  }

  return results
}

export function buildNextWorldStimulusState(
  input: BuildWorldStimuliInput
): WorldStimulusSystemState {
  const activeStimuli = filterExpiredStimuli(
    input.existingStimuli,
    input.tick
  ).map((stimulus) =>
    updateStimulusSpatialState(stimulus, input.tick)
  )

  const latestGenerated = buildEcologyDrivenStimuli({
    ...input,
    existingStimuli: activeStimuli,
  })

  return {
    activeStimuli: [...activeStimuli, ...latestGenerated],
    latestGenerated,
  }
}