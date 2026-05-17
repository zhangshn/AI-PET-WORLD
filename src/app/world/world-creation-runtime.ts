/**
 * 当前文件负责：为 app/world 保留创建世界运行时兼容导出。
 */

export {
  buildBirthSignature,
  buildWorldCreationRuntime,
  CREATE_WORLD_STORAGE_KEY,
  parseCreateWorldInput,
  serializeCreateWorldInput,
} from "@/world/creation/world-creation-runtime"

export type {
  CreateWorldInput,
  CreateWorldPerspective,
  WorldCreationRuntimeInput,
  WorldCreationRuntimeResult,
} from "@/world/creation/world-creation-schema"