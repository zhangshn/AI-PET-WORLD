import type {
  FullZiweiChart,
  ZiweiBirthInput,
  ZiweiPlacementContext
} from "../contracts"

import {
  convertNormalizedZiweiBirthInputToLunarInfo,
  normalizeZiweiBirthInput
} from "../birth"
import { buildZiweiNatalFoundation } from "../natal-foundation"
import { applyZiweiStarBrightness } from "../star-catalog"
import { placeZiweiStars } from "../star-placement"

import { buildFullZiweiChartDebug } from "./full-chart-debug-builder"
import { buildFullZiweiChartSummary } from "./full-chart-summary"
import { validateFullZiweiChart } from "./full-chart-validator"
import { buildFullZiweiPalaces } from "./palace-detail-builder"

export function buildFullZiweiChart(input: ZiweiBirthInput): FullZiweiChart {
  const normalizedInput = normalizeZiweiBirthInput(input)
  const lunarInfo =
    convertNormalizedZiweiBirthInputToLunarInfo(normalizedInput)
  const foundation = buildZiweiNatalFoundation(lunarInfo)
  const context: ZiweiPlacementContext = {
    ruleSetVersion: normalizedInput.ruleSetVersion,
    input: normalizedInput,
    lunarInfo,
    foundation
  }
  const placementResultWithoutBrightness = placeZiweiStars(context)
  const placementResult = {
    ...placementResultWithoutBrightness,
    stars: placementResultWithoutBrightness.stars.map(applyZiweiStarBrightness)
  }
  const palaces = buildFullZiweiPalaces({
    foundation,
    placedStars: placementResult.stars
  })

  const chartWithoutDebug: Omit<FullZiweiChart, "debug"> = {
    ruleSetVersion: normalizedInput.ruleSetVersion,
    input: normalizedInput,
    lunarInfo,
    foundation,
    palaces,
    summary: buildFullZiweiChartSummary({
      foundation,
      palaces
    })
  }

  const validationWarnings = validateFullZiweiChart({
    ...chartWithoutDebug,
    debug: {
      ruleSetVersion: normalizedInput.ruleSetVersion,
      placementWarnings: placementResult.warnings,
      validationWarnings: []
    }
  })

  return {
    ...chartWithoutDebug,
    debug: buildFullZiweiChartDebug({
      ruleSetVersion: normalizedInput.ruleSetVersion,
      placementResult,
      validationWarnings
    })
  }
}
