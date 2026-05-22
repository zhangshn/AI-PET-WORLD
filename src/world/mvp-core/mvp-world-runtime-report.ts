/**
 * 当前文件职责：生成 MVP world runtime tick 报告。
 */

import type { ConstructionRuntimeVerticalSliceResult } from "@/world/construction/construction-schema"

import type { MvpWorldRuntimeAudit } from "./mvp-world-runtime-audit"

export type MvpWorldRuntimeReport = {
  reportId: string
  sections: Array<{
    title: string
    lines: string[]
    tags: string[]
  }>
  messages: string[]
  tags: string[]
}

export function buildMvpWorldRuntimeReport(
  result: {
    constructionResult: ConstructionRuntimeVerticalSliceResult
    tickReason: string
  },
  audit: MvpWorldRuntimeAudit
): MvpWorldRuntimeReport {
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
          ? ["MVP runtime tick audit has no warnings."]
          : audit.warnings,
      tags: ["section:audit"],
    },
  ]

  return {
    reportId: `mvp-runtime-report-${normalizeIdToken(audit.stableRuntimeFingerprint).slice(0, 48)}`,
    sections,
    messages: sections.flatMap((section) => section.lines),
    tags: ["mvp_world_runtime_report", "not_ui_model"],
  }
}

function normalizeIdToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
