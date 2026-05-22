/**
 * 当前文件职责：生成 MVP 管家人格映射报告。
 */

import type {
  ButlerMvpAudit,
  ButlerMvpBuildResult,
  ButlerMvpReport,
} from "./butler-mvp-schema"

export function buildButlerMvpReport(
  result: ButlerMvpBuildResult,
  audit: ButlerMvpAudit
): ButlerMvpReport {
  return {
    reportId: `butler-mvp-report-${normalizeIdToken(result.profile.butlerId)}`,
    butlerId: result.profile.butlerId,
    summary: "管家作为玩家生命投射管理者进入 MVP 世界。",
    sections: [
      {
        title: "Profile",
        lines: [
          `Tone: ${result.profile.explanationTone}`,
          `Life rhythm: ${result.profile.lifeRhythmBias}`,
          `Visual tendency: ${result.profile.visualTendency}`,
        ],
        tags: ["section:profile"],
      },
      {
        title: "Audit",
        lines:
          audit.warnings.length === 0
            ? ["Butler MVP profile audit has no warnings."]
            : audit.warnings,
        tags: ["section:audit"],
      },
    ],
    messages: [...result.messages, ...audit.warnings],
    tags: [
      "butler_mvp_report",
      "not_ui_world_fact",
      "no_default_companion_entry",
    ],
  }
}

function normalizeIdToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
