/**
 * 当前文件负责：根据世界环境参数判断当前天气与环境氛围。
 */

import type {
  WorldEnvironment,
  WorldEnvironmentMood,
  WorldWeather,
} from "./world-environment"

export function resolveWorldWeather(
  environment: WorldEnvironment
): WorldWeather {
  if (environment.temperature <= 8 && environment.lightLevel <= 35) {
    return "cold_night"
  }

  if (environment.temperature >= 23 && environment.lightLevel >= 55) {
    return "warm_morning"
  }

  if (environment.humidity >= 72) {
    return "rainy"
  }

  if (environment.humidity >= 62 && environment.lightLevel <= 45) {
    return "foggy"
  }

  if (environment.windLevel >= 55) {
    return "breezy"
  }

  if (environment.lightLevel <= 40) {
    return "cloudy"
  }

  return "clear"
}

export function resolveEnvironmentMood(
  environment: WorldEnvironment
): WorldEnvironmentMood {
  if (environment.stability <= 35) {
    return "tense"
  }

  if (environment.temperature <= 10) {
    return "cold"
  }

  if (environment.windLevel >= 55) {
    return "fresh"
  }

  if (environment.temperature >= 24 && environment.lightLevel >= 55) {
    return "warm"
  }

  if (environment.lightLevel <= 30 && environment.windLevel <= 25) {
    return "quiet"
  }

  if (environment.lightLevel >= 70 && environment.windLevel >= 35) {
    return "lively"
  }

  return "stable"
}