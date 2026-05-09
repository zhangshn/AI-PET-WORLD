/**
 * 当前文件负责：作为自主驱动层下宠物行为意图选择与稳定控制的公开包装。
 *
 * 注意：
 * 当前阶段只包装既有 pet-action 实现，不改变运行逻辑。
 * pet-action 属于第 7 层：自主驱动层 / 行为意图选择。
 * 后续会把 raw action intent 与 stability 逻辑逐步迁入 action-intention。
 */

export {
  applyPetActionStability,
  selectPetAction,
  type ActionDecisionReason,
  type ActionStabilityState,
  type SelectPetActionInput,
  type SelectPetActionResult,
} from "../pet-action/pet-action-gateway"
