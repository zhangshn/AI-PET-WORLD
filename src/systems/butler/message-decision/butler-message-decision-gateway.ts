/**
 * 当前文件负责：统一导出管家主动消息判断层公开入口。
 *
 * message-decision 只判断是否形成联系玩家意图。
 * 不直接发送 P-Phone 消息。
 */

export {
  buildButlerMessageDecision,
} from "./butler-message-decision-runner"

export type {
  BuildButlerMessageDecisionInput,
  ButlerMessageDecision,
  ButlerMessageDecisionPriority,
  ButlerMessageDecisionReason,
} from "./butler-message-decision-schema"
