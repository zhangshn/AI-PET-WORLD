/**
 * 当前文件负责：提供管家关系与后天经历调参入口。
 */

import type { ButlerRelationState } from "./butler-relation"

import {
  buildButlerExperienceInterpretation,
  type ButlerExperienceInterpreterInput,
  type ButlerRelationTaskTuning,
} from "./butler-experience-interpreter"

export type {
  ButlerExperienceInterpretation,
  ButlerExperienceInterpreterInput,
  ButlerRelationTaskTuning,
} from "./butler-experience-interpreter"

export {
  buildButlerExperienceInterpretation,
} from "./butler-experience-interpreter"

export function buildButlerRelationTaskTuning(
  input:
    | ButlerExperienceInterpreterInput
    | ButlerRelationState
    | null
    | undefined
): ButlerRelationTaskTuning {
  if (!input) {
    return buildButlerExperienceInterpretation({
      relation: null,
      profile: null,
    }).tuning
  }

  if ("relation" in input) {
    return buildButlerExperienceInterpretation(input).tuning
  }

  return buildButlerExperienceInterpretation({
    relation: input,
    profile: null,
  }).tuning
}