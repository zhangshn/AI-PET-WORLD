/**
 * ======================================================
 * AI-PET-WORLD
 * Personality Gateway
 * ======================================================
 *
 * 【文件职责】
 * 这是 personality-core 子模块的统一入口。
 *
 * 注意：
 * 这是“人格子系统入口”，不是整个 src/ai 的总入口。
 *
 * 整个 AI 系统的统一调度入口在：
 * src/ai/gateway.ts
 * ======================================================
 */

import { calculateBirthPattern } from "./calculator"
import { mapBirthPatternToPersonalityProfile } from "./mapper"

import type {
  BirthInput,
  BirthPattern,
  PersonalityProfile
} from "./schema"

/**
 * 根据出生输入构建底盘
 */
export function buildBirthPattern(input: BirthInput): BirthPattern {
  return calculateBirthPattern(input)
}

/**
 * 根据底盘构建人格结果
 */
export function buildPersonalityFromPattern(
  pattern: BirthPattern
): PersonalityProfile {
  return mapBirthPatternToPersonalityProfile(pattern)
}

/**
 * 根据出生输入直接构建完整人格结果
 */
export function buildPersonalityProfile(
  input: BirthInput
): PersonalityProfile {
  const pattern = buildBirthPattern(input)
  return buildPersonalityFromPattern(pattern)
}