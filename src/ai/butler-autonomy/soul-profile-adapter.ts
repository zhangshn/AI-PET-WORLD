/**
 * 当前文件职责：把管家人格结果适配为自主意识层使用的长期倾向。
 */

import type { ButlerProfile } from "@/ai/personality-core/butler-profile-core/butler-profile-gateway"

import type { ButlerSoulProfile } from "./butler-autonomy-schema"

export function buildButlerSoulProfileFromButlerProfile(
  profile: ButlerProfile
): ButlerSoulProfile {
  const bias = profile.bias
  const careDrive = clampScore(bias.carePriority)
  const boundaryDrive = clampScore(bias.boundarySensitivity)
  const patience = clampScore(bias.observationPatience)
  const orderPreference = clampScore(
    Math.round((bias.constructionDrive + bias.boundarySensitivity) / 2)
  )
  const resourcePrudence = clampScore(
    Math.round((bias.observationPatience + bias.boundarySensitivity) / 2)
  )

  return {
    soulId: `butler-soul-${simpleHash(profile.identity.displayName)}`,
    source: "butler_profile_adapter",
    riskSensitivity: resourcePrudence,
    orderPreference,
    careDrive,
    explorationDrive: clampScore(100 - patience),
    boundaryDrive,
    resourcePrudence,
    socialWarmth: clampScore(
      Math.round((bias.carePriority + bias.opportunityInitiative) / 2)
    ),
    patience,
    rhythmBias: "balanced",
    explanationTone: profile.boundaryStyle === "watchful_boundary" ? "protective" : "calm",
    sourceButlerProfile: {
      careStyle: profile.careStyle,
      buildStyle: profile.buildStyle,
      boundaryStyle: profile.boundaryStyle,
      opportunityStyle: profile.opportunityStyle,
      bias: profile.bias,
    },
    summary: [
      `${profile.identity.displayName} 的长期倾向已转为管家自主意识底盘。`,
      `照护 ${careDrive}/100，秩序 ${orderPreference}/100，边界 ${boundaryDrive}/100，耐心 ${patience}/100。`,
    ].join(""),
    tags: [
      "butler_soul_profile",
      "from_butler_profile",
      profile.careStyle,
      profile.buildStyle,
      profile.boundaryStyle,
      profile.opportunityStyle,
    ],
  }
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function simpleHash(value: string): string {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) >>> 0
  }

  return hash.toString(16).padStart(8, "0")
}
