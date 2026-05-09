/**
 * 当前文件负责：统一导出宠物生命日常状态层的公开入口。
 *
 * daily-state 属于第 4 层：生命日常状态层。
 * 它只维护和暴露宠物当下生命状态相关能力，不直接决定行为。
 */

export {
  runPetLife,
  type RunPetLifeInput,
  type RunPetLifeResult,
} from "./life-stage/pet-life-stage-gateway"

export {
  mapTimelineStateToPetMood,
} from "./emotion-state/pet-emotion-state-gateway"
