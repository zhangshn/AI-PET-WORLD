import type { WorldVisualAuthorizedDataManifest } from "../world-visual-painter-schema"

const AUTHORIZED_DATA_ITEMS: WorldVisualAuthorizedDataManifest["items"] = [
  {
    id: "mvp-user-owned-target-principle-note",
    title: {
      zh: "MVP 目标图抽象原则记录",
      en: "MVP target image abstract principle note",
    },
    dataKind: "self_written_rule_note",
    usage: "extract_visual_rules",
    license: "self_owned",
    sourcePathOrUrl: "internal://world-visual-painter/mvp-target-principles",
    licenseEvidence: {
      zh: "由项目内部整理，只提炼构图、层次、光色、密度等抽象原则，不导入外部图片像素。",
      en: "Prepared internally by the project. It extracts abstract composition, depth, lighting, color, and density principles without importing external image pixels.",
    },
    canTrainOnImagePixels: false,
    canExtractRules: true,
    canUseAsConditionReference: true,
    mustAvoidDirectCopy: true,
    status: "accepted",
    notes: {
      zh: "这是当前 MVP 已接受的数据项。它是规则数据，不是训练图片数据。",
      en: "This is the accepted MVP data item. It is rule data, not image-pixel training data.",
    },
    tags: ["mvp", "rule_data", "self_owned", "no_external_pixels"],
  },
]

export function buildWorldVisualAuthorizedDataManifest(): WorldVisualAuthorizedDataManifest {
  const acceptedItems = AUTHORIZED_DATA_ITEMS.filter(
    (item) => item.status === "accepted"
  )

  return {
    manifestId: "world-visual-authorized-data-mvp-v1",
    version: "authorized-data-mvp-v1",
    items: AUTHORIZED_DATA_ITEMS,
    acceptedTrainableCount: acceptedItems.filter(
      (item) => item.canTrainOnImagePixels
    ).length,
    acceptedRuleOnlyCount: acceptedItems.filter(
      (item) => item.canExtractRules && !item.canTrainOnImagePixels
    ).length,
    blockedCount: AUTHORIZED_DATA_ITEMS.filter((item) => item.status === "blocked")
      .length,
    importPolicy: {
      zh: "允许项目负责人在项目外人工使用 AI 图像工具制作训练图，再作为 AI 辅助自制位图导入。项目不得连接在线绘图 API；所有图片必须记录来源、许可、哈希并禁止直接复制具体作品。",
      en: "The project owner may manually use an AI image tool outside the project and import the result as an AI-assisted project-created bitmap. The project must not connect to online drawing APIs; every image requires provenance, license evidence, hashes, and a no-direct-copy rule.",
    },
    tags: [
      "authorized_data_manifest",
      "copyright_safe",
      "authorized_dataset_ingestion_required",
      "no_unlicensed_training_data",
    ],
  }
}
