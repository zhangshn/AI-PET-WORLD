import type {
  BuildZiweiInterpretationInput,
  ZiweiChartInterpretation
} from "../contracts"

import { buildChartHighlights } from "./chart-highlight-builder"
import { buildZiweiChartContentDetails } from "./content-detail-summary-builder"
import { buildZiweiChartDetailedAnalysis } from "./detailed-analysis-builder"
import { buildPalaceInterpretation } from "./palace-interpretation-builder"

export function buildZiweiChartInterpretation(
  input: BuildZiweiInterpretationInput
): ZiweiChartInterpretation {
  const palaceInterpretations = input.chart.palaces.map((palace) => {
    return buildPalaceInterpretation({
      palace,
      palaces: input.chart.palaces
    })
  })
  const chartHighlights = buildChartHighlights(input.chart)
  const contentDetails = buildZiweiChartContentDetails(input.chart)
  const detailedAnalysis = buildZiweiChartDetailedAnalysis({
    chart: input.chart,
    dynamicChart: input.dynamicChart
  })
  const totalItems =
    chartHighlights.length +
    palaceInterpretations.reduce((sum, palace) => {
      return sum + palace.items.length
    }, 0)

  return {
    chartHighlights,
    palaceInterpretations,
    contentDetails,
    detailedAnalysis,
    debug: {
      generatedBy: "ziwei-core/interpretation",
      totalItems
    }
  }
}
