/**
 * 当前文件职责：生成 MVP P-Phone 摘要数据。
 */

import type {
  CompanionDecisionCandidate,
  LifeEventCandidate,
} from "@/world/life-event/life-event-schema"

import type { MvpButlerExplanationEntry } from "./mvp-butler-explanation"
import type { MvpWorldLogEntry } from "./mvp-world-log"

export type MvpPPhoneMessage = {
  id: string
  title: string
  body: string
  tags: string[]
}

export type MvpPPhoneData = {
  id: string
  statusLabel: string
  messages: MvpPPhoneMessage[]
  tags: string[]
}

export function buildMvpPPhoneData(input: {
  worldId: string
  logs: MvpWorldLogEntry[]
  butlerExplanations: MvpButlerExplanationEntry[]
  lifeEventCandidates?: LifeEventCandidate[]
  companionDecisionCandidates?: CompanionDecisionCandidate[]
  warningCount: number
}): MvpPPhoneData {
  const lifeEventMessages = buildLifeEventMessages({
    worldId: input.worldId,
    lifeEventCandidates: input.lifeEventCandidates ?? [],
    companionDecisionCandidates: input.companionDecisionCandidates ?? [],
  })

  return {
    id: `mvp-pphone-${normalizeIdToken(input.worldId)}`,
    statusLabel:
      input.warningCount > 0 ? "MVP 闭环需要检查" : "MVP 闭环运行正常",
    messages: [
      ...input.logs.map((log) => ({
        id: `phone-${log.id}`,
        title: log.title,
        body: log.body,
        tags: ["mvp_pphone_message", ...log.tags],
      })),
      ...input.butlerExplanations.map((item) => ({
        id: `phone-${item.id}`,
        title: item.title,
        body: item.body,
        tags: ["mvp_pphone_message", ...item.tags],
      })),
      ...lifeEventMessages,
    ],
    tags: [
      "mvp_pphone_data",
      "read_only_summary",
      "not_world_fact",
      "no_default_adoption_entry",
      "life_event_01_summary",
    ],
  }
}

function buildLifeEventMessages(input: {
  worldId: string
  lifeEventCandidates: LifeEventCandidate[]
  companionDecisionCandidates: CompanionDecisionCandidate[]
}): MvpPPhoneMessage[] {
  const primaryLifeEvent = input.lifeEventCandidates[0]
  const primaryDecision = input.companionDecisionCandidates[0]

  if (!primaryLifeEvent && !primaryDecision) {
    return [
      {
        id: `phone-life-event-${normalizeIdToken(input.worldId)}-empty`,
        title: "小镇领养观察",
        body: "当前没有伴生生命候选，世界会继续观察资源、空间和建设状态。",
        tags: [
          "mvp_pphone_message",
          "life_event_01",
          "no_adoption_intent",
          "read_only_summary",
        ],
      },
    ]
  }

  const readiness = primaryLifeEvent?.readiness ?? primaryDecision?.readiness
  const readinessText = readiness
    ? `准备度 ${readiness.score}/100，状态：${toReadinessLabel(readiness.status)}。`
    : "准备度暂未计算。"
  const blockerText =
    readiness && readiness.blockers.length > 0
      ? `等待原因：${readiness.blockers
          .map((blocker) => blocker.reason)
          .join("；")}`
      : "当前没有关键阻塞项，但伴生生命仍保持后置。"

  return [
    {
      id: `phone-life-event-${normalizeIdToken(input.worldId)}-candidate`,
      title: "小镇领养观察",
      body: [
        readinessText,
        primaryLifeEvent?.reason ?? "当前没有生命事件候选。",
        blockerText,
      ].join(" "),
      tags: [
        "mvp_pphone_message",
        "life_event_01",
        "town_adoption_deferred_only",
        "read_only_summary",
      ],
    },
    {
      id: `phone-life-event-${normalizeIdToken(input.worldId)}-decision`,
      title: "管家判断",
      body:
        primaryDecision?.reason ??
        "管家会继续观察家园建设、资源状态与空间压力。",
      tags: [
        "mvp_pphone_message",
        "life_event_01",
        "butler_adoption_intent_candidate",
        "no_actor_creation",
      ],
    },
  ]
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

function normalizeIdToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
