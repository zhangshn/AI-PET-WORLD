/**
 * 当前文件负责：作为宠物系统运行编排层的公开包装。
 *
 * 注意：
 * 当前阶段只包装既有 pet-runtime 实现，不改变运行逻辑。
 * pet-runtime 属于 runtime_orchestration：单 Tick 编排层。
 * 后续会逐步把 pet-runtime 内部逻辑收敛为只调用各层 gateway。
 */

export {
  runPetRuntimeTick,
} from "../pet-runtime/pet-runtime-runner"

export type {
  RunPetRuntimeTickInput,
  RunPetRuntimeTickResult,
} from "../pet-runtime/pet-runtime-runner"
