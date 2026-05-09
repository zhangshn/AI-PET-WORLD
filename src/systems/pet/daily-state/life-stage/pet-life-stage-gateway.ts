/**
 * 当前文件负责：作为 daily-state 下宠物生命阶段状态的公开入口。
 *
 * 注意：
 * 当前阶段只包装既有 pet-life 实现，不改变运行逻辑。
 * 后续再逐步把 pet-life 的状态类逻辑迁入 daily-state。
 */

export {
  runPetLife,
  type RunPetLifeInput,
  type RunPetLifeResult,
} from "../../pet-life/pet-life-gateway"
