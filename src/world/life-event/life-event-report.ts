/**
 * 当前文件职责：生成生命事件与伴生生命后置候选报告。
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
      "life_event_01",
      "town_adoption_deferred_only",
      "not_ui_model",
      "no_actor_creation",
    ],
  }
}

function buildLifeEventReportSections(input: {
  lifeEventCandidates: LifeEventCandidate[]
  companionDecisionCandidates: CompanionDecisionCandidate[]
  audit: LifeEventAudit
}): LifeEventReportSection[] {
  return [
    buildReadinessSection(input.lifeEventCandidates),
    buildLifeEventCandidateSection(input.lifeEventCandidates),
    buildCompanionDecisionSection(input.companionDecisionCandidates),
    buildBlockerSection(input.lifeEventCandidates),
    buildAuditSection(input.audit),
  ]
}

function buildReadinessSection(
  candidates: LifeEventCandidate[]
): LifeEventReportSection {
  const readiness = candidates[0]?.readiness

  if (!readiness) {
    return {
      title: "生命事件准备度",
      status: "skipped",
      lines: ["当前没有可计算的生命事件准备度。"],
      tags: ["section:life_event_readiness"],
    }
  }

  return {
    title: "生命事件准备度",
    status: readiness.status === "not_ready" ? "warning" : "ok",
    lines: [
      `当前准备度：${readiness.score} / 100。`,
      `状态：${toReadinessLabel(readiness.status)}。`,
      `建议下一步：${toRecommendedNextStepLabel(readiness.recommendedNextStep)}。`,
      `资源：${readiness.resourceReadiness.reasons.join("；")}。`,
      `世界：${readiness.worldReadiness.reasons.join("；")}。`,
    ],
    tags: [
      "section:life_event_readiness",
      `life_event_status:${readiness.status}`,
    ],
  }
}

function buildLifeEventCandidateSection(
  candidates: LifeEventCandidate[]
): LifeEventReportSection {
  return {
    title: "生命事件候选",
    status: candidates.length > 0 ? "ok" : "skipped",
    lines:
      candidates.length > 0
        ? candidates.map(
            (candidate) =>
              `${toLifeEventKindLabel(candidate.kind)}：${candidate.reason}`
          )
        : ["当前没有生命事件候选。"],
    tags: ["section:life_event_candidate"],
  }
}

function buildCompanionDecisionSection(
  candidates: CompanionDecisionCandidate[]
): LifeEventReportSection {
  return {
    title: "伴生生命决策",
    status: candidates.length > 0 ? "ok" : "skipped",
    lines:
      candidates.length > 0
        ? candidates.map(
            (candidate) =>
              `${toCompanionDecisionLabel(candidate.kind)}：${candidate.reason} ${candidate.nextCheckHint}`
          )
        : ["当前没有伴生生命决策候选。"],
    tags: ["section:butler_adoption_intent_candidate"],
  }
}

function buildBlockerSection(
  candidates: LifeEventCandidate[]
): LifeEventReportSection {
  const blockers = candidates.flatMap((candidate) => candidate.blockers)

  return {
    title: "阻塞与等待理由",
    status: blockers.length > 0 ? "warning" : "ok",
    lines:
      blockers.length > 0
        ? blockers.map(
            (blocker) =>
              `${toBlockerSeverityLabel(blocker.severity)} / ${toBlockerSourceLabel(blocker.source)}：${blocker.reason}`
          )
        : ["当前没有关键阻塞项，伴生生命仍保持后置观察。"],
    tags: ["section:life_event_blockers"],
  }
}

function buildAuditSection(audit: LifeEventAudit): LifeEventReportSection {
  return {
    title: "LifeEvent Audit",
    status: audit.warnings.length === 0 ? "ok" : "warning",
    lines:
      audit.warnings.length === 0
        ? [
            `LifeEvent audit 通过。准备度 ${audit.readinessScore}，阻塞项 ${audit.blockerCount}。`,
          ]
        : audit.warnings,
    tags: ["section:audit"],
  }
}

function toReadinessLabel(
  status: LifeEventCandidate["readiness"]["status"]
): string {
  const labels = {
    not_ready: "尚未准备好",
    preparing: "准备中",
    observable: "可以观察",
    eligible_later: "未来可记录机会",
  } satisfies Record<LifeEventCandidate["readiness"]["status"], string>

  return labels[status]
}

function toRecommendedNextStepLabel(
  step: LifeEventCandidate["readiness"]["recommendedNextStep"]
): string {
  const labels = {
    wait: "继续等待",
    prepare_resources: "优先准备资源与空间",
    continue_construction: "继续推进家园建设",
    observe_world: "观察世界稳定性",
    record_future_opportunity: "记录未来机会",
  } satisfies Record<
    LifeEventCandidate["readiness"]["recommendedNextStep"],
    string
  >

  return labels[step]
}

function toLifeEventKindLabel(kind: LifeEventCandidate["kind"]): string {
  const labels = {
    no_event: "暂无事件",
    observe_world_ready: "世界可观察",
    adoption_candidate_later: "未来伴生机会",
    construction_dependency_not_ready: "建设条件未满足",
  } satisfies Record<LifeEventCandidate["kind"], string>

  return labels[kind]
}

function toCompanionDecisionLabel(
  kind: CompanionDecisionCandidate["kind"]
): string {
  const labels = {
    no_adoption_intent: "暂无决策",
    wait_and_observe: "等待观察",
    prepare_world_first: "先准备世界",
    eligible_later: "未来可评估",
  } satisfies Record<CompanionDecisionCandidate["kind"], string>

  return labels[kind]
}

function toBlockerSeverityLabel(
  severity: LifeEventCandidate["blockers"][number]["severity"]
): string {
  const labels = {
    info: "提示",
    warning: "提醒",
    blocking: "阻塞",
  } satisfies Record<
    LifeEventCandidate["blockers"][number]["severity"],
    string
  >

  return labels[severity]
}

function toBlockerSourceLabel(
  source: LifeEventCandidate["blockers"][number]["source"]
): string {
  const labels = {
    resource: "资源",
    space: "空间",
    construction: "建设",
    world_stability: "世界稳定",
    safety_boundary: "安全边界",
    audit: "审计",
  } satisfies Record<LifeEventCandidate["blockers"][number]["source"], string>

  return labels[source]
}

function normalizeIdToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}