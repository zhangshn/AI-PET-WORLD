/**
 * 当前文件负责：统一导出宠物 AI 学习层公开入口。
 *
 * learning 属于第 6 层：AI 学习层。
 * 它只把 memory 中的经验材料沉淀为稳定倾向，不直接控制 action。
 */

export {
  createInitialPetLearningState,
} from "./pet-learning-builder"

export {
  updatePetLearningState,
} from "./pet-learning-updater"

export type {
  PetLearningState,
  UpdatePetLearningInput,
} from "./pet-learning-schema"