/**
 * 当前文件负责：作为 behavior 下宠物可见行为表达的公开包装。
 *
 * 注意：
 * 当前阶段只包装既有 pet-expression 实现，不改变运行逻辑。
 * pet-expression 属于第 8 层：行为执行层。
 * 后续会把可见行为表达逻辑逐步迁入 behavior/expression。
 */

export {
  expressPetAction,
} from "../../pet-expression/pet-expression-gateway"

export type {
  PetExpressionInput,
  PetExpressionReason,
  PetExpressionResult,
} from "../../pet-expression/pet-expression-gateway"
