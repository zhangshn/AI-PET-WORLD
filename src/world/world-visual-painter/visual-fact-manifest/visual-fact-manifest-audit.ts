import type {
  WorldVisualBilingualText,
  WorldVisualFactManifest,
  WorldVisualFactManifestAudit,
} from "../world-visual-painter-schema"

export function auditWorldVisualFactManifest(
  manifest: WorldVisualFactManifest
): WorldVisualFactManifestAudit {
  const warnings: WorldVisualBilingualText[] = [
    ...auditSourceFacts(manifest),
    ...auditPrimaryFacts(manifest),
    ...auditResourceFacts(manifest),
  ]

  return {
    ok: warnings.length === 0,
    warnings,
    tags: [
      "world_visual_fact_manifest_audit",
      warnings.length === 0 ? "fact_manifest_valid" : "fact_manifest_warning",
    ],
  }
}

function auditSourceFacts(
  manifest: WorldVisualFactManifest
): WorldVisualBilingualText[] {
  if (manifest.sourceFactIds.length > 0) return []

  return [
    {
      zh: "视觉事实清单没有任何 sourceFactId，不能进入后续画面生成。",
      en: "Visual fact manifest has no sourceFactId and cannot continue to image generation.",
    },
  ]
}

function auditPrimaryFacts(
  manifest: WorldVisualFactManifest
): WorldVisualBilingualText[] {
  if (manifest.primaryFacts.length > 0) return []

  return [
    {
      zh: "视觉事实清单没有 primary fact，画面会缺少主焦点。",
      en: "Visual fact manifest has no primary fact, so the image will lack a focal point.",
    },
  ]
}

function auditResourceFacts(
  manifest: WorldVisualFactManifest
): WorldVisualBilingualText[] {
  const resource = manifest.resourceFact
  const values = [
    resource.groundHealth,
    resource.naturalGrowth,
    resource.materialReadiness,
    resource.careReadiness,
    resource.spacePressure,
  ]

  if (values.every((value) => Number.isFinite(value))) return []

  return [
    {
      zh: "资源事实存在非法数值，不能用于视觉密度和地形表达。",
      en: "Resource facts contain invalid values and cannot drive visual density or terrain expression.",
    },
  ]
}
