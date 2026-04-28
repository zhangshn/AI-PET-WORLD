/**
 * 当前文件负责：定义世界舞台基础尺寸配置。
 */

export const WORLD_STAGE_SIZE = {
  width: 1280,
  height: 720,
} as const

export type WorldStageSize = typeof WORLD_STAGE_SIZE