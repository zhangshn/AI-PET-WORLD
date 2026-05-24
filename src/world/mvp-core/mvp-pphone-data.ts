/**
 * 当前文件职责：生成 MVP P-Phone 摘要数据。
 */

import type {
  ButlerAdoptionIntentCandidate,
  TownAdoptionCandidate,
} from "@/world/adoption/town-adoption-precheck-schema"

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
  townAdoptionCandidates?: TownAdoptionCandidate[]
  butlerAdoptionIntentCandidates?: ButlerAdoptionIntentCandidate[]
  warningCount: number
}): MvpPPhoneData {
  const townAdoptionMessages = buildTownAdoptionMessages({
    worldId: input.worldId,
    townAdoptionCandidates: input.townAdoptionCandidates ?? [],
    butlerAdoptionIntentCandidates: input.butlerAdoptionIntentCandidates ?? [],
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
      ...townAdoptionMessages,
    ],
    tags: [
      "mvp_pphone_data",
      "read_only_summary",
      "not_world_fact",
      "no_default_adoption_entry",
      "town_adoption_precheck_01_summary",
    ],
  }
}

function buildTownAdoptionMessages(input: {
  worldId: string
  townAdoptionCandidates: TownAdoptionCandidate[]
  butlerAdoptionIntentCandidates: ButlerAdoptionIntentCandidate[]
}): MvpPPhoneMessage[] {
  const primaryTownAdoptionCandidate = input.townAdoptionCandidates[0]
  const primaryDecision = input.butlerAdoptionIntentCandidates[0]

  if (!primaryTownAdoptionCandidate && !primaryDecision) {
    return [
      {
        id: `phone-town-adoption-${normalizeIdToken(input.worldId)}-empty`,
        title: "小镇领养观察",
        body: "当前没有领养候选，世界会继续观察资源、空间和建设状态。",
        tags: [
          "mvp_pphone_message",
          "town_adoption_precheck_01",
          "no_adoption_intent",
          "read_only_summary",
        ],
      },
    ]
  }

  const readiness = primaryTownAdoptionCandidate?.readiness ?? primaryDecision?.readiness
  const readinessText = readiness
    ? `准备度 ${readiness.score}/100，状态：${toReadinessLabel(readiness.status)}。`
    : "准备度暂未计算。"
  const blockerText =
    readiness && readiness.blockers.length > 0
      ? `等待原因：${readiness.blockers
          .map((blocker) => blocker.reason)
          .join("；")}`
      : "当前没有关键阻塞项，但领养候选仍保持后置。"

  return [
    {
      id: `phone-town-adoption-${normalizeIdToken(input.worldId)}-candidate`,
      title: "小镇领养观察",
      body: [
        readinessText,
        primaryTownAdoptionCandidate?.reason ?? "当前没有领养候选观察。",
        blockerText,
      ].join(" "),
      tags: [
        "mvp_pphone_message",
        "town_adoption_precheck_01",
        "town_adoption_deferred_only",
        "read_only_summary",
      ],
    },
    {
      id: `phone-town-adoption-${normalizeIdToken(input.worldId)}-decision`,
      title: "管家判断",
      body:
        primaryDecision?.reason ??
        "管家会继续观察家园建设、资源状态与空间压力。",
      tags: [
        "mvp_pphone_message",
        "town_adoption_precheck_01",
        "butler_adoption_intent_candidate",
        "no_actor_creation",
      ],
    },
  ]
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

function normalizeIdToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
