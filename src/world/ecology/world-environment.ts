/**
 * 当前文件负责：定义世界环境状态、天气、季节、环境氛围与默认环境生成。
 */

export type WorldSeason =
  | "spring"
  | "summer"
  | "autumn"
  | "winter"

export type WorldWeather =
  | "clear"
  | "cloudy"
  | "breezy"
  | "rainy"
  | "foggy"
  | "cold_night"
  | "warm_morning"

export type WorldEnvironmentMood =
  | "stable"
  | "fresh"
  | "warm"
  | "quiet"
  | "cold"
  | "tense"
  | "lively"

export type WorldEnvironment = {
  temperature: number
  humidity: number
  windLevel: number
  lightLevel: number
  stability: number
  season: WorldSeason
  activeWeather: WorldWeather
  environmentMood: WorldEnvironmentMood
}

export function createDefaultWorldEnvironment(): WorldEnvironment {
  return {
    temperature: 22,
    humidity: 48,
    windLevel: 18,
    lightLevel: 70,
    stability: 82,
    season: "spring",
    activeWeather: "clear",
    environmentMood: "stable",
  }
}