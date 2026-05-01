/**
 * 当前文件负责：提供 ziwei-core 子模块的统一调用入口。
 */

import { calculateBirthPattern } from "./calculator"
import { mapBirthPatternToPersonalityProfile } from "./mapper"

import type {
  BirthInput,
  BirthPattern,
  PersonalityProfile
} from "./schema"

/**
 * 根据出生输入构建底盘。
 */
export function buildBirthPattern(input: BirthInput): BirthPattern {
  return calculateBirthPattern(input)
}

/**
 * 根据底盘构建人格结果。
 */
export function buildPersonalityFromPattern(
  pattern: BirthPattern
): PersonalityProfile {
  return mapBirthPatternToPersonalityProfile(pattern)
}

/**
 * 根据出生输入直接构建完整人格结果。
 */
export function buildPersonalityProfile(
  input: BirthInput
): PersonalityProfile {
  const pattern = buildBirthPattern(input)
  return buildPersonalityFromPattern(pattern)
}

/**
 * 紫微动态运势模块入口。
 */
export {
  buildZiweiDynamicChartOnly,
  buildZiweiDynamicInfluence
} from "./dynamic/dynamic-gateway"

/**
 * 紫微动态运势模块输入类型。
 */
export type {
  BuildZiweiDynamicInfluenceInput
} from "./dynamic/dynamic-gateway"

/**
 * 紫微动态运势模块输出类型。
 */
export type {
  ZiweiDynamicChart,
  ZiweiDynamicInfluence,
  ZiweiDynamicResult
} from "./dynamic/dynamic-schema"