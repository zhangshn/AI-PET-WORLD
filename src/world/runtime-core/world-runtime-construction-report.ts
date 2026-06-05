import type { ConstructionRuntimeVerticalSliceResult } from "@/world/construction/construction-schema"

import type { WorldRuntimeConstructionAudit } from "./world-runtime-construction-audit"

export type WorldRuntimeConstructionReport = {
  reportId: string
  sections: Array<{
    title: string
    lines: string[]
    tags: string[]
  }>
  messages: string[]
  tags: string[]
}

export function buildWorldRuntimeConstructionReport(
  result: {
    constructionResult: ConstructionRuntimeVerticalSliceResult
    tickReason: string
  },
  audit: WorldRuntimeConstructionAudit
): WorldRuntimeConstructionReport {
  const sections = [
    {
      title: "Runtime Tick",
      lines: [
        `Reason: ${result.tickReason}`,
        `Selected plan: ${
          result.constructionResult.fullPipelineAudit.selectedPlanId ?? "none"
        }`,
      ],
      tags: ["section:runtime_tick"],
    },
    {
      title: "Audit",
      lines:
        audit.warnings.length === 0
          ? ["runtime runtime tick audit has no warnings."]
          : audit.warnings,
      tags: ["section:audit"],
    },
  ]

  return {
    reportId: `world-runtime-construction-report-${normalizeIdToken(audit.stableRuntimeFingerprint).slice(0, 48)}`,
    sections,
    messages: sections.flatMap((section) => section.lines),
    tags: ["world_runtime_construction_report", "not_ui_model"],
  }
}

function normalizeIdToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
