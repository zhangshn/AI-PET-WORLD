/**
 * 当前文件负责：统一导出管家行为执行层的公开入口。
 *
 * behavior 属于第 8 层：行为执行层。
 * 它只负责把上层意图或教育判断转为可见行为 / 世界操作，不负责意图判断。
 */

export {
  createApproachOffer,
  createFoodOffer,
  createRestOffer,
} from "./opportunity-action/butler-opportunity-action-gateway"
