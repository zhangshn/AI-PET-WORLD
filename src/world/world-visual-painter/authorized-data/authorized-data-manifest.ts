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
    canUseAsPromptReference: true,
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
      zh: "只允许导入自有、CC0、或明确商业授权的数据。未授权图片不能训练、不能复制、不能作为素材库；公开资料只能提炼抽象规则。",
      en: "Only self-owned, CC0, or explicitly commercially licensed data may be imported. Unlicensed images cannot be trained on, copied, or used as an asset library. Public materials may only be used for abstract rule extraction.",
    },
    tags: [
      "authorized_data_manifest",
      "copyright_safe",
      "manual_import_required",
      "no_unlicensed_training_data",
    ],
  }
}
