/**
 * 当前文件职责：生成生命事件与伙伴决策后置候选报告。
 */

import type {
  CompanionDecisionCandidate,
  LifeEventAudit,
  LifeEventCandidate,
  LifeEventReport,
  LifeEventReportSection,
} from "./life-event-schema"

export function buildLifeEventReport(input: {
  lifeEventCandidates: LifeEventCandidate[]
  companionDecisionCandidates: CompanionDecisionCandidate[]
  audit: LifeEventAudit
}): LifeEventReport {
  const sections = buildLifeEventReportSections(input)

  return {
    reportId: [
      "life-event-report",
      normalizeIdToken(input.audit.worldId),
      normalizeIdToken(input.audit.stableLifeEventFingerprint).slice(0, 48),
    ].join("-"),
    worldId: input.audit.worldId,
    ownerId: input.audit.ownerId,
    sections,
    messages: sections.flatMap((section) => section.lines),
    tags: [
      "life_event_report",
      "delayed_companion_entry_only",
      "not_ui_model",
    ],
  }
}

function buildLifeEventReportSections(input: {
  lifeEventCandidates: LifeEventCandidate[]
  companionDecisionCandidates: CompanionDecisionCandidate[]
  audit: LifeEventAudit
}): LifeEventReportSection[] {
  return [
    {
      title: "LifeEvent Candidate",
      status: input.lifeEventCandidates.length > 0 ? "ok" : "skipped",
      lines: input.lifeEventCandidates.map(
        (candidate) => `${candidate.kind}: ${candidate.reason}`
      ),
      tags: ["section:life_event_candidate"],
    },
    {
      title: "CompanionDecision Candidate",
      status: input.companionDecisionCandidates.length > 0 ? "ok" : "skipped",
      lines: input.companionDecisionCandidates.map(
        (candidate) => `${candidate.kind}: ${candidate.reason}`
      ),
      tags: ["section:companion_decision_candidate"],
    },
    {
      title: "Audit",
      status: input.audit.warnings.length === 0 ? "ok" : "warning",
      lines:
        input.audit.warnings.length === 0
          ? ["LifeEvent candidate audit has no warnings."]
          : input.audit.warnings,
      tags: ["section:audit"],
    },
  ]
}

function normalizeIdToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
