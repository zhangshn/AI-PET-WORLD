import type {
  BuildZiweiInterpretationInput,
  ZiweiChartInterpretation
} from "../contracts"

import { buildChartHighlights } from "./chart-highlight-builder"
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
  const totalItems =
    chartHighlights.length +
    palaceInterpretations.reduce((sum, palace) => {
      return sum + palace.items.length
    }, 0)

  return {
    chartHighlights,
    palaceInterpretations,
    debug: {
      generatedBy: "ziwei-core/interpretation",
      totalItems
    }
  }
}
