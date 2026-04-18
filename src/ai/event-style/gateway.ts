/**
 * ======================================================
 * AI-PET-WORLD
 * Event Style - Gateway
 *
 * 功能：
 * 作为事件文案核心模块的唯一对外入口
 *
 * 使用规则：
 * 1. 外部系统只能从这里调用
 * 2. 外部不要直接 import composer.ts / schema.ts
 * 3. 这样可以把内部文案逻辑整体收口
 * ======================================================
 */

import { composeStyledPetEventMessage } from "./composer"
import type { PetEventStyleInput } from "./schema"

/**
 * ======================================================
 * 对外入口：
 * 生成宠物事件的风格化中文文案
 * ======================================================
 */
export function buildPetEventMessage(
  input: PetEventStyleInput
): string {
  console.log("事件文案模块：开始生成人格化事件文本。", {
    scene: input.scene,
    petName: input.petName
  })

  const message = composeStyledPetEventMessage(input)

  console.log("事件文案模块：事件文本生成完成。", {
    scene: input.scene,
    petName: input.petName,
    message
  })

  return message
}

/**
 * ======================================================
 * 对外导出输入类型
 * ======================================================
 */
export type { PetEventStyleInput } from "./schema"