/**
 * 当前文件负责：根据管家当前任务推导管家情绪表现。
 */

import type { ButlerMood, ButlerTask } from "./butler-schema"

export function deriveButlerMood(task: ButlerTask): ButlerMood {
  switch (task) {
    case "watching_incubator":
      return "focused"
    case "building_home":
      return "busy"
    case "offering_food":
      return "gentle"
    case "offering_rest":
      return "gentle"
    case "offering_approach":
      return "calm"
    case "watching_pet":
      return "calm"
    case "idle":
    default:
      return "calm"
  }
}