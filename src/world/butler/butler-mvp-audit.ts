/**
 * 当前文件职责：审计 MVP 管家人格映射结果。
 */

import type { ButlerMvpAudit, ButlerMvpBuildResult } from "./butler-mvp-schema"

const FORBIDDEN_BUTLER_TOKENS = [
  "pet_actor",
]

export function auditButlerMvpProfile(
  result: ButlerMvpBuildResult
): ButlerMvpAudit {
  const warnings = auditForbiddenTokens(result)

  return {
    stableButlerFingerprint: [
      result.profile.playerId,
      result.profile.ownerId,
      result.profile.worldId,
      result.profile.butlerId,
      result.profile.lifeRhythmBias,
      result.profile.explanationTone,
      result.profile.visualTendency,
    ].join("::"),
    butlerId: result.profile.butlerId,
    warnings,
    tags: [
      "butler_mvp_audit",
      warnings.length === 0 ? "butler_mvp_valid" : "butler_mvp_warning",
      "no_default_adoption_entry",
    ],
  }
}

function auditForbiddenTokens(result: ButlerMvpBuildResult): string[] {
  const tokens = [
    ...result.tags,
    ...result.messages,
    ...result.profile.tags,
  ].map((token) => token.toLowerCase())

  return FORBIDDEN_BUTLER_TOKENS.flatMap((token) =>
    tokens.some((item) => item.includes(token))
      ? [`Butler MVP profile 包含禁止 token：${token}`]
      : []
  )
}
