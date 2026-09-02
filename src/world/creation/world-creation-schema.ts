/**
 * 当前文件负责：定义创建世界输入与运行时生成参数。
 */

import type { ButlerConstructionStyleVector } from "@/world/generation/generation-schema"
import type {
  ButlerProfile,
  ButlerProfileBirthInput,
  ButlerMappingMode,
} from "@/ai/personality-core/butler-profile-core/butler-profile-gateway"
import type { CreateWorldInput } from "./world-creation-client-schema"

export type {
  CreateWorldInput,
  CreateWorldPerspective,
} from "./world-creation-client-schema"

export type WorldCreationStyleSource =
  | "life_profile_core"
  | "deterministic_fallback"

export type WorldCreationRuntimeInput = {
  createWorldInput: CreateWorldInput
  /** Unique server-issued identity for this world instance. */
  worldInstanceId: string
}

export type WorldCreationRuntimeResult = {
  worldId: string
  ownerId: string
  worldInstanceId: string
  birthSignature: string
  worldSalt: string
  butlerProfile: ButlerProfile
  butlerBirthInput: ButlerProfileBirthInput
  butlerMappingMode: ButlerMappingMode
  butlerConstructionStyle: ButlerConstructionStyleVector
  now: number
  styleSource: WorldCreationStyleSource
  debug: {
    source: "world_creation_runtime"
    note: string
    warnings: string[]
  }
}
