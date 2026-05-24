/**
 * 当前文件职责：生成小镇领养观察与小镇领养观察候选报告。
 */

import type {
  ButlerAdoptionIntentCandidate,
  TownAdoptionPrecheckAudit,
  TownAdoptionCandidate,
  TownAdoptionPrecheckReport,
  TownAdoptionPrecheckReportSection,
} from "./town-adoption-precheck-schema"

export function buildTownAdoptionPrecheckReport(input: {
  townAdoptionCandidates: TownAdoptionCandidate[]
  butlerAdoptionIntentCandidates: ButlerAdoptionIntentCandidate[]
  audit: TownAdoptionPrecheckAudit
}): TownAdoptionPrecheckReport {
  const sections = buildTownAdoptionPrecheckReportSections(input)

  return {
    reportId: [
      "town-adoption-report",
      normalizeIdToken(input.audit.worldId),
      normalizeIdToken(input.audit.stableTownAdoptionFingerprint).slice(0, 48),
    ].join("-"),
    worldId: input.audit.worldId,
    ownerId: input.audit.ownerId,
    sections,
    messages: sections.flatMap((section) => section.lines),
    tags: [
      "town_adoption_precheck_report",
      "town_adoption_precheck_01",
      "town_adoption_deferred_only",
      "not_ui_model",
      "no_actor_creation",
    ],
  }
}

function buildTownAdoptionPrecheckReportSections(input: {
  townAdoptionCandidates: TownAdoptionCandidate[]
  butlerAdoptionIntentCandidates: ButlerAdoptionIntentCandidate[]
  audit: TownAdoptionPrecheckAudit
}): TownAdoptionPrecheckReportSection[] {
  return [
    buildReadinessSection(input.townAdoptionCandidates),
    buildTownAdoptionCandidateSection(input.townAdoptionCandidates),
    buildButlerAdoptionIntentSection(input.butlerAdoptionIntentCandidates),
    buildBlockerSection(input.townAdoptionCandidates),
    buildAuditSection(input.audit),
  ]
}

function buildReadinessSection(
  candidates: TownAdoptionCandidate[]
): TownAdoptionPrecheckReportSection {
  const readiness = candidates[0]?.readiness

  if (!readiness) {
    return {
      title: "小镇领养准备度",
      status: "skipped",
      lines: ["当前没有可计算的小镇领养准备度。"],
      tags: ["section:town_adoption_precheck_readiness"],
    }
  }

  return {
    title: "小镇领养准备度",
    status: readiness.status === "not_ready" ? "warning" : "ok",
    lines: [
      `当前准备度：${readiness.score} / 100。`,
      `状态：${toReadinessLabel(readiness.status)}。`,
      `建议下一步：${toRecommendedNextStepLabel(readiness.recommendedNextStep)}。`,
      `资源：${readiness.resourceReadiness.reasons.join("；")}。`,
      `世界：${readiness.worldReadiness.reasons.join("；")}。`,
    ],
    tags: [
      "section:town_adoption_precheck_readiness",
      `town_adoption_precheck_status:${readiness.status}`,
    ],
  }
}

function buildTownAdoptionCandidateSection(
  candidates: TownAdoptionCandidate[]
): TownAdoptionPrecheckReportSection {
  return {
    title: "领养候选观察",
    status: candidates.length > 0 ? "ok" : "skipped",
    lines:
      candidates.length > 0
        ? candidates.map(
            (candidate) =>
              `${toTownAdoptionKindLabel(candidate.kind)}：${candidate.reason}`
          )
        : ["当前没有领养候选观察。"],
    tags: ["section:town_adoption_precheck_candidate"],
  }
}

function buildButlerAdoptionIntentSection(
  candidates: ButlerAdoptionIntentCandidate[]
): TownAdoptionPrecheckReportSection {
  return {
    title: "管家领养意愿",
    status: candidates.length > 0 ? "ok" : "skipped",
    lines:
      candidates.length > 0
        ? candidates.map(
            (candidate) =>
              `${toButlerAdoptionIntentLabel(candidate.kind)}：${candidate.reason} ${candidate.nextCheckHint}`
          )
        : ["当前没有管家领养意愿候选。"],
    tags: ["section:butler_adoption_intent_candidate"],
  }
}

function buildBlockerSection(
  candidates: TownAdoptionCandidate[]
): TownAdoptionPrecheckReportSection {
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
        : ["当前没有关键阻塞项，领养候选仍保持后置观察。"],
    tags: ["section:town_adoption_precheck_blockers"],
  }
}

function buildAuditSection(audit: TownAdoptionPrecheckAudit): TownAdoptionPrecheckReportSection {
  return {
    title: "TownAdoptionPrecheck Audit",
    status: audit.warnings.length === 0 ? "ok" : "warning",
    lines:
      audit.warnings.length === 0
        ? [
            `TownAdoptionPrecheck audit 通过。准备度 ${audit.readinessScore}，阻塞项 ${audit.blockerCount}。`,
          ]
        : audit.warnings,
    tags: ["section:audit"],
  }
}

function toReadinessLabel(
  status: TownAdoptionCandidate["readiness"]["status"]
): string {
  const labels = {
    not_ready: "尚未准备好",
    preparing: "准备中",
    observable: "可以观察",
    eligible_later: "未来可记录机会",
  } satisfies Record<TownAdoptionCandidate["readiness"]["status"], string>

  return labels[status]
}

function toRecommendedNextStepLabel(
  step: TownAdoptionCandidate["readiness"]["recommendedNextStep"]
): string {
  const labels = {
    wait: "继续等待",
    prepare_resources: "优先准备资源与空间",
    continue_construction: "继续推进家园建设",
    observe_world: "观察世界稳定性",
    record_future_opportunity: "记录未来机会",
  } satisfies Record<
    TownAdoptionCandidate["readiness"]["recommendedNextStep"],
    string
  >

  return labels[step]
}

function toTownAdoptionKindLabel(kind: TownAdoptionCandidate["kind"]): string {
  const labels = {
    no_event: "暂无事件",
    observe_world_ready: "世界可观察",
    adoption_candidate_later: "未来领养机会",
    construction_dependency_not_ready: "建设条件未满足",
  } satisfies Record<TownAdoptionCandidate["kind"], string>

  return labels[kind]
}

function toButlerAdoptionIntentLabel(
  kind: ButlerAdoptionIntentCandidate["kind"]
): string {
  const labels = {
    no_adoption_intent: "暂无决策",
    wait_and_observe: "等待观察",
    prepare_world_first: "先准备世界",
    eligible_later: "未来可评估",
  } satisfies Record<ButlerAdoptionIntentCandidate["kind"], string>

  return labels[kind]
}

function toBlockerSeverityLabel(
  severity: TownAdoptionCandidate["blockers"][number]["severity"]
): string {
  const labels = {
    info: "提示",
    warning: "提醒",
    blocking: "阻塞",
  } satisfies Record<
    TownAdoptionCandidate["blockers"][number]["severity"],
    string
  >

  return labels[severity]
}

function toBlockerSourceLabel(
  source: TownAdoptionCandidate["blockers"][number]["source"]
): string {
  const labels = {
    resource: "资源",
    space: "空间",
    construction: "建设",
    world_stability: "世界稳定",
    safety_boundary: "安全边界",
    audit: "审计",
  } satisfies Record<TownAdoptionCandidate["blockers"][number]["source"], string>

  return labels[source]
}

function normalizeIdToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}