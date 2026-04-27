/**
 * 当前文件负责：把天气状态转换为世界运行层可用的影响系数。
 */

import type { WorldEnvironment } from "../ecology/world-environment"

export type WeatherRuntimeEffect = {
  visibilityModifier: number
  movementModifier: number
  creatureSpawnModifier: number
  comfortModifier: number
}

export function resolveWeatherRuntimeEffect(
  environment: WorldEnvironment
): WeatherRuntimeEffect {
  switch (environment.activeWeather) {
    case "rainy":
      return {
        visibilityModifier: -15,
        movementModifier: -10,
        creatureSpawnModifier: -20,
        comfortModifier: -6,
      }

    case "foggy":
      return {
        visibilityModifier: -25,
        movementModifier: -4,
        creatureSpawnModifier: -8,
        comfortModifier: -2,
      }

    case "breezy":
      return {
        visibilityModifier: 0,
        movementModifier: -2,
        creatureSpawnModifier: 8,
        comfortModifier: 2,
      }

    case "cold_night":
      return {
        visibilityModifier: -18,
        movementModifier: -8,
        creatureSpawnModifier: -25,
        comfortModifier: -14,
      }

    case "warm_morning":
      return {
        visibilityModifier: 8,
        movementModifier: 3,
        creatureSpawnModifier: 15,
        comfortModifier: 12,
      }

    case "cloudy":
      return {
        visibilityModifier: -8,
        movementModifier: 0,
        creatureSpawnModifier: -2,
        comfortModifier: 0,
      }

    case "clear":
    default:
      return {
        visibilityModifier: 5,
        movementModifier: 0,
        creatureSpawnModifier: 5,
        comfortModifier: 4,
      }
  }
}