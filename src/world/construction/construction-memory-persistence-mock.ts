/**
 * 当前文件职责：模拟建设持久化提案的内存保存结果。
 */

import type {
  HomeMapState,
} from "@/world/map-state/home-map-state-schema"

import type {
  ConstructionMemoryPersistenceMockResult,
  ConstructionPersistenceProposal,
} from "./construction-schema"

export function buildConstructionMemoryPersistenceMockResult(input: {
  proposal: ConstructionPersistenceProposal | null
  nextHomeMapState: HomeMapState
}): ConstructionMemoryPersistenceMockResult {
  if (!input.proposal) {
    return {
      mockPersistenceId: buildMockPersistenceId({
        worldId: input.nextHomeMapState.worldId,
        updatedAt: input.nextHomeMapState.updatedAt,
        proposalId: "none",
      }),
      proposalId: null,
      didStore: false,
      storedWorldId: input.nextHomeMapState.worldId,
      storedUpdatedAt: null,
      acceptedDiffIds: [],
      reason: "未生成持久化提案，内存 mock 不保存。",
      tags: [
        "construction_memory_persistence_mock",
        "mock_only",
        "not_real_persistence",
        "no_storage_write",
      ],
    }
  }

  const didStore = input.proposal.shouldPersist

  return {
    mockPersistenceId: buildMockPersistenceId({
      worldId: input.proposal.worldId,
      updatedAt: input.proposal.nextUpdatedAt,
      proposalId: input.proposal.proposalId,
    }),
    proposalId: input.proposal.proposalId,
    didStore,
    storedWorldId: input.proposal.worldId,
    storedUpdatedAt: didStore ? input.proposal.nextUpdatedAt : null,
    acceptedDiffIds: input.proposal.acceptedDiffIds,
    reason: didStore
      ? "内存 mock 已记录本轮 nextHomeMapState 摘要；这不是正式持久化。"
      : "持久化提案未通过保存条件，内存 mock 不保存。",
    tags: [
      "construction_memory_persistence_mock",
      "mock_only",
      "not_real_persistence",
      "no_storage_write",
      didStore ? "mock_store_ready" : "mock_store_skipped",
    ],
  }
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
