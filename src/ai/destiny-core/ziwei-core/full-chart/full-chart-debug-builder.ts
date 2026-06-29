import type {
  FullZiweiChartDebug,
  ZiweiPlacementResult
} from "../contracts"

export function buildFullZiweiChartDebug(params: {
  ruleSetVersion: string
  placementResult: ZiweiPlacementResult
  validationWarnings: string[]
}): FullZiweiChartDebug {
  return {
    ruleSetVersion: params.ruleSetVersion,
    placementWarnings: params.placementResult.warnings,
    validationWarnings: params.validationWarnings
  }
}
