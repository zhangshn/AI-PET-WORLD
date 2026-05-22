/**
 * 当前文件职责：模拟建设持久化提案的内存保存结果。
 */

import type { HomeMapState } from "@/world/map-state/home-map-state-schema"

import type {
  ConstructionMemoryPersistenceMode,
  ConstructionMemoryPersistenceMockResult,
  ConstructionPersistenceProposal,
} from "./construction-schema"

export function buildConstructionMemoryPersistenceMockResult(input: {
  proposal: ConstructionPersistenceProposal | null
  nextHomeMapState: HomeMapState
  mode?: ConstructionMemoryPersistenceMode
}): ConstructionMemoryPersistenceMockResult {
  const mode = input.mode ?? "memory_commit"

  if (!input.proposal) {
    return {
      mockPersistenceId: buildMockPersistenceId({
        worldId: input.nextHomeMapState.worldId,
        updatedAt: input.nextHomeMapState.updatedAt,
        proposalId: "none",
      }),
      proposalId: null,
      mode,
      didStore: false,
      shouldCommit: false,
      previewOnly: mode === "memory_preview",
      storedWorldId: input.nextHomeMapState.worldId,
      storedUpdatedAt: null,
      acceptedDiffIds: [],
      reason: "未生成持久化提案，memory mock 不记录任何世界事实。",
      tags: buildMockPersistenceTags({
        mode,
        didStore: false,
      }),
    }
  }

  const shouldCommit =
    mode === "memory_commit" && input.proposal.shouldPersist
  const didStore = shouldCommit

  return {
    mockPersistenceId: buildMockPersistenceId({
      worldId: input.proposal.worldId,
      updatedAt: input.proposal.nextUpdatedAt,
      proposalId: input.proposal.proposalId,
    }),
    proposalId: input.proposal.proposalId,
    mode,
    didStore,
    shouldCommit,
    previewOnly: mode === "memory_preview",
    storedWorldId: input.proposal.worldId,
    storedUpdatedAt: didStore ? input.proposal.nextUpdatedAt : null,
    acceptedDiffIds: input.proposal.acceptedDiffIds,
    reason: buildMockPersistenceReason({
      mode,
      shouldPersist: input.proposal.shouldPersist,
      didStore,
    }),
    tags: buildMockPersistenceTags({
      mode,
      didStore,
    }),
  }
}

function buildMockPersistenceReason(input: {
  mode: ConstructionMemoryPersistenceMode
  shouldPersist: boolean
  didStore: boolean
}): string {
  if (input.mode === "disabled") {
    return "memory mock 已禁用，本轮不会记录内存提交。"
  }

  if (input.mode === "memory_preview") {
    return input.shouldPersist
      ? "memory mock 仅预览可提交结果，不记录内存提交。"
      : "持久化提案未满足条件，memory preview 不记录提交。"
  }

  return input.didStore
    ? "memory mock 已记录本轮 nextHomeMapState 摘要；这不是正式持久化。"
    : "持久化提案未满足条件，memory mock 不记录提交。"
}

function buildMockPersistenceTags(input: {
  mode: ConstructionMemoryPersistenceMode
  didStore: boolean
}): string[] {
  return [
    "construction_memory_persistence_mock",
    "mock_only",
    "not_real_persistence",
    "no_storage_write",
    `memory_mode:${input.mode}`,
    input.didStore ? "mock_store_ready" : "mock_store_skipped",
  ]
}

function buildMockPersistenceId(input: {
  worldId: string
  updatedAt: number
  proposalId: string
}): string {
  return [
    "construction-memory-mock",
    normalizeIdToken(input.worldId),
    String(input.updatedAt),
    normalizeIdToken(input.proposalId),
  ].join("-")
}

function normalizeIdToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
