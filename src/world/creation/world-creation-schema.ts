/**
 * 当前文件负责：定义创建世界输入与运行时生成参数。
 */

import type { ButlerConstructionStyleVector } from "@/world/generation/generation-schema"

export type CreateWorldPerspective = "unspecified" | "female" | "male"

export type CreateWorldInput = {
  year: number
  month: number
  day: number
  time: string
  perspective: CreateWorldPerspective
  createdAt: number
}

export type WorldCreationRuntimeInput = {
  createWorldInput: CreateWorldInput
}

export type WorldCreationRuntimeResult = {
  worldId: string
  ownerId: string
  birthSignature: string
  worldSalt: string
  butlerConstructionStyle: ButlerConstructionStyleVector
  now: number
}