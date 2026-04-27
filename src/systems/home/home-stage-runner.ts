/**
 * 当前文件负责：根据家园建造进度判断施工阶段。
 */

import type { HomeConstructionStage } from "@/types/home"

export function resolveConstructionStage(
  progress: number
): HomeConstructionStage {
  if (progress <= 0) return "temporary_shelter"
  if (progress < 20) return "foundation"
  if (progress < 45) return "frame"
  if (progress < 65) return "roof"
  if (progress < 85) return "interior"
  if (progress < 100) return "garden"

  return "completed"
}