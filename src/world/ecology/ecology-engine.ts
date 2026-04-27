/**
 * 当前文件负责：推进世界生态环境状态，并输出最新世界环境与区域状态。
 */

import {
  createDefaultWorldEnvironment,
  type WorldEnvironment,
} from "./world-environment"
import {
  resolveEnvironmentMood,
  resolveWorldWeather,
} from "./weather-system"
import {
  createDefaultWorldZones,
} from "./zone-system"
import type { WorldZone } from "./world-zone-types"

export type UpdateWorldEcologyInput = {
  tick: number
  time: {
    day: number
    hour: number
    period?: string
  }
  previousEnvironment?: WorldEnvironment | null
  previousZones?: WorldZone[] | null
}

export type WorldEcologyState = {
  environment: WorldEnvironment
  zones: WorldZone[]
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

function resolveLightLevel(hour: number): number {
  if (hour >= 6 && hour <= 8) return 48
  if (hour >= 9 && hour <= 16) return 82
  if (hour >= 17 && hour <= 19) return 52
  if (hour >= 20 || hour <= 5) return 18

  return 55
}

function resolveTemperatureDelta(hour: number): number {
  if (hour >= 6 && hour <= 8) return 1
  if (hour >= 9 && hour <= 15) return 2
  if (hour >= 16 && hour <= 18) return 0
  if (hour >= 19 || hour <= 5) return -2

  return 0
}

function updateEnvironmentByTime(
  environment: WorldEnvironment,
  input: UpdateWorldEcologyInput
): WorldEnvironment {
  const hour = input.time.hour

  const lightLevel = resolveLightLevel(hour)
  const temperatureDelta = resolveTemperatureDelta(hour)

  const windWave = Math.sin(input.tick * 0.35) * 6
  const humidityWave = Math.cos(input.tick * 0.22) * 4
  const stabilityWave = Math.sin(input.tick * 0.12) * 2

  const temperature = clamp(
    environment.temperature + temperatureDelta * 0.35,
    -10,
    42
  )

  const humidity = clamp(
    environment.humidity + humidityWave * 0.25,
    10,
    95
  )

  const windLevel = clamp(
    environment.windLevel + windWave * 0.22,
    0,
    100
  )

  const stability = clamp(
    environment.stability + stabilityWave * 0.3,
    0,
    100
  )

  const nextEnvironment: WorldEnvironment = {
    ...environment,
    temperature: Math.round(temperature),
    humidity: Math.round(humidity),
    windLevel: Math.round(windLevel),
    lightLevel,
    stability: Math.round(stability),
  }

  return {
    ...nextEnvironment,
    activeWeather: resolveWorldWeather(nextEnvironment),
    environmentMood: resolveEnvironmentMood(nextEnvironment),
  }
}

export function buildNextWorldEcologyState(
  input: UpdateWorldEcologyInput
): WorldEcologyState {
  const baseEnvironment =
    input.previousEnvironment ?? createDefaultWorldEnvironment()

  const environment = updateEnvironmentByTime(baseEnvironment, input)

  return {
    environment,
    zones: input.previousZones ?? createDefaultWorldZones(),
  }
}