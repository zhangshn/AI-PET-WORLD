/**
 * 当前文件负责：把 timeline 情绪标签映射成宠物展示 mood。
 */

import type { PetMood } from "../../../types/pet"

export function mapTimelineStateToPetMood(label: string): PetMood {
  if (label === "excited" || label === "content" || label === "relaxed") {
    return "happy"
  }

  if (label === "alert") return "alert"
  if (label === "curious") return "curious"

  if (label === "anxious" || label === "irritated" || label === "low") {
    return "sad"
  }

  return "normal"
}