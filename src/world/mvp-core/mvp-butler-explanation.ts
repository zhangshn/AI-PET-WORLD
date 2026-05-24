/**
 * 当前文件职责：生成 MVP 管家解释条目。
 */

import type { ButlerMvpProfile } from "@/world/butler/butler-mvp-schema"

import type { MvpWorldRuntimeTickResult } from "./mvp-world-runtime-tick"

export type MvpButlerExplanationEntry = {
  id: string
  title: string
  body: string
  tags: string[]
}

export function buildMvpButlerExplanations(input: {
  butlerProfile: ButlerMvpProfile
  runtimeTick: MvpWorldRuntimeTickResult
}): MvpButlerExplanationEntry[] {
  const selectedPlanId =
    input.runtimeTick.constructionResult.fullPipelineAudit.selectedPlanId

  return [
    {
      id: `mvp-butler-explanation-${normalizeIdToken(input.butlerProfile.butlerId)}`,
      title: "管家观察",
      body: selectedPlanId
        ? `我会先推进 ${selectedPlanId}，并等待 SafeApply 与视觉刷新预检确认。`
        : "我会继续观察家园资源、空间和阶段，等待合适的建设机会。",
      tags: [
        "mvp_butler_explanation",
        "observation_management_tone",
        "not_direct_pet_dialogue",
      ],
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
