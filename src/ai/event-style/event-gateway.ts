/**
 * ======================================================
 * AI-PET-WORLD
 * Event Gateway
 * ======================================================
 *
 * 当前文件负责：
 * 1. 作为 event-style 子模块的统一入口
 * 2. 对外暴露构建宠物事件文案的方法
 *
 * 注意：
 * - 这是“事件表现子系统入口”
 * - 不是整个 src/ai 的总入口
 * - 整个 AI 系统的统一调度入口仍然是：src/ai/gateway.ts
 * ======================================================
 */

import { composeStyledPetEventMessage } from "./composer"
import type { PetEventStyleInput } from "./schema"

/**
 * 构建宠物事件文案
 */
export function buildPetEventMessage(
  input: PetEventStyleInput
): string {
  return composeStyledPetEventMessage(input)
}