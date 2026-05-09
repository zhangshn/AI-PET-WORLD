/**
 * 当前文件负责：作为自主驱动层下宠物感知 / 主体解释的公开包装。
 *
 * 注意：
 * 当前阶段只包装既有 pet-cognition 实现，不改变运行逻辑。
 * pet-cognition 属于第 7 层：自主驱动层中的感知 / 解释入口。
 * 后续会把世界 signal → 宠物主体解释的逻辑逐步迁入 cognition/perception。
 */

export {
  runPetStimulusPerception,
  type RunPetStimulusPerceptionInput,
  type RunPetStimulusPerceptionResult,
} from "../../pet-cognition/pet-cognition-gateway"
