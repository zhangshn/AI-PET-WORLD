import { calculateBirthPattern } from "./calculator"
import { mapPatternToProfile } from "./mapper"
import type {
  BirthInput,
  PersonalityProfile,
  TimeBranch
} from "./schema"

/**
 * ======================================================
 * AI-PET-WORLD
 * Personality Core - Gateway
 *
 * 说明：
 * - 这是人格核心系统的唯一对外出口
 * - 外部模块不要直接依赖 calculator / mapper / schema
 * - 所有页面、系统、业务层统一从这里接入
 * ======================================================
 */

/**
 * 新标准入口
 */
export function buildPersonalityProfile(
  input: BirthInput
): PersonalityProfile {
  const pattern = calculateBirthPattern(input)
  return mapPatternToProfile(pattern)
}

/**
 * 兼容旧代码
 */
export const createPersonalityProfile = buildPersonalityProfile

/**
 * 统一对外导出类型
 * 外部一律从 gateway 引，不直接碰 schema
 */
export type {
  BirthInput,
  PersonalityProfile,
  TimeBranch
} from "./schema"

/**
 * 如有需要，也可以在 gateway 层统一提供工具函数
 * 这样页面层就不需要自己重复写
 */
export function getTimeBranchText(branch: TimeBranch): string {
  if (branch === "zi") return "子时（23:00 - 00:59）"
  if (branch === "chou") return "丑时（01:00 - 02:59）"
  if (branch === "yin") return "寅时（03:00 - 04:59）"
  if (branch === "mao") return "卯时（05:00 - 06:59）"
  if (branch === "chen") return "辰时（07:00 - 08:59）"
  if (branch === "si") return "巳时（09:00 - 10:59）"
  if (branch === "wu") return "午时（11:00 - 12:59）"
  if (branch === "wei") return "未时（13:00 - 14:59）"
  if (branch === "shen") return "申时（15:00 - 16:59）"
  if (branch === "you") return "酉时（17:00 - 18:59）"
  if (branch === "xu") return "戌时（19:00 - 20:59）"
  return "亥时（21:00 - 22:59）"
}