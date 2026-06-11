import { buildWorldVisualAuthorizedDataManifest } from "../authorized-data"
import type {
  WorldVisualAuthorizedDataItem,
  WorldVisualAuthorizedDataManifest,
  WorldVisualBilingualText,
} from "../world-visual-painter-schema"

const D0_REQUIRED_MIN_IMAGE_COUNT = 20
const D0_TARGET_MAX_IMAGE_COUNT = 50

export type WorldVisualTrainingDataStage = "d0_baseline"

export type WorldVisualTrainingDataStatus =
  | "d0_missing"
  | "d0_insufficient"
  | "d0_ready"

export type WorldVisualTrainingDataRequirement = {
  id: string
  title: WorldVisualBilingualText
  required: boolean
  fulfilled: boolean
  tags: string[]
}

export type WorldVisualTrainingDataManifest = {
  manifestId: string
  version: "world-visual-training-data-mvp-v1"
  stage: WorldVisualTrainingDataStage
  status: WorldVisualTrainingDataStatus
  requiredMinImageCount: number
  targetMaxImageCount: number
  acceptedTrainableImageCount: number
  missingImageCount: number
  readyForTraining: boolean
  trainableItems: WorldVisualAuthorizedDataItem[]
  blockedItems: WorldVisualAuthorizedDataItem[]
  requirements: WorldVisualTrainingDataRequirement[]
  policy: WorldVisualBilingualText
  tags: string[]
}

export function buildWorldVisualTrainingDataManifest(
  authorizedDataManifest: WorldVisualAuthorizedDataManifest =
    buildWorldVisualAuthorizedDataManifest()
): WorldVisualTrainingDataManifest {
  const trainableItems = authorizedDataManifest.items.filter(isAcceptedTrainableImageItem)
  const blockedItems = authorizedDataManifest.items.filter(
    (item) => item.status === "blocked" || item.usage === "blocked"
  )
  const acceptedTrainableImageCount = trainableItems.length
  const missingImageCount = Math.max(
    0,
    D0_REQUIRED_MIN_IMAGE_COUNT - acceptedTrainableImageCount
  )
  const status = resolveTrainingDataStatus(acceptedTrainableImageCount)
  const readyForTraining = status === "d0_ready"

  return {
    manifestId: "world-visual-training-data-d0-v1",
    version: "world-visual-training-data-mvp-v1",
    stage: "d0_baseline",
    status,
    requiredMinImageCount: D0_REQUIRED_MIN_IMAGE_COUNT,
    targetMaxImageCount: D0_TARGET_MAX_IMAGE_COUNT,
    acceptedTrainableImageCount,
    missingImageCount,
    readyForTraining,
    trainableItems,
    blockedItems,
    requirements: buildD0Requirements({
      acceptedTrainableImageCount,
      blockedCount: blockedItems.length,
    }),
    policy: {
      zh: "D0 只接收自有、CC0 或明确商业授权的位图数据。规则笔记不能计入训练图片数量；未授权图片不能训练、不能复制、不能作为素材库。",
      en: "D0 only accepts self-owned, CC0, or explicitly commercially licensed bitmap data. Rule notes do not count as training images; unlicensed images cannot be trained on, copied, or used as an asset library.",
    },
    tags: [
      "world_visual_training_data_manifest",
      "m1_data_spec_and_d0",
      "d0_baseline",
      readyForTraining ? "d0_ready" : "d0_not_ready",
      `accepted_trainable_image_count:${acceptedTrainableImageCount}`,
      `missing_d0_image_count:${missingImageCount}`,
      "no_unlicensed_training_data",
      "does_not_generate",
      "does_not_modify_world_facts",
    ],
  }
}

function isAcceptedTrainableImageItem(
  item: WorldVisualAuthorizedDataItem
): boolean {
  return (
    item.status === "accepted" &&
    item.usage === "train_image_model" &&
    item.canTrainOnImagePixels === true &&
    (item.dataKind === "self_created_bitmap" ||
      item.dataKind === "licensed_bitmap" ||
      item.dataKind === "cc0_bitmap") &&
    (item.license === "self_owned" ||
      item.license === "cc0" ||
      item.license === "commercial_license")
  )
}

function resolveTrainingDataStatus(
  acceptedTrainableImageCount: number
): WorldVisualTrainingDataStatus {
  if (acceptedTrainableImageCount === 0) return "d0_missing"
  if (acceptedTrainableImageCount < D0_REQUIRED_MIN_IMAGE_COUNT) {
    return "d0_insufficient"
  }

  return "d0_ready"
}

function buildD0Requirements(input: {
  acceptedTrainableImageCount: number
  blockedCount: number
}): WorldVisualTrainingDataRequirement[] {
  const hasD0Minimum = input.acceptedTrainableImageCount >= D0_REQUIRED_MIN_IMAGE_COUNT
  const hasNoBlockedItems = input.blockedCount === 0

  return [
    {
      id: "d0_minimum_trainable_image_count",
      title: {
        zh: `D0 至少需要 ${D0_REQUIRED_MIN_IMAGE_COUNT} 张合法训练图片。`,
        en: `D0 requires at least ${D0_REQUIRED_MIN_IMAGE_COUNT} legal training images.`,
      },
      required: true,
      fulfilled: hasD0Minimum,
      tags: [
        "d0_requirement",
        "trainable_image_count",
        hasD0Minimum ? "fulfilled" : "missing",
      ],
    },
    {
      id: "d0_authorized_bitmap_only",
      title: {
        zh: "D0 只能统计自有、CC0 或商业授权位图，规则笔记不计入图片数量。",
        en: "D0 may only count self-owned, CC0, or commercially licensed bitmaps; rule notes do not count as images.",
      },
      required: true,
      fulfilled: true,
      tags: ["d0_requirement", "authorized_bitmap_only", "fulfilled"],
    },
    {
      id: "d0_no_blocked_training_items",
      title: {
        zh: "D0 训练清单不能包含被阻断或未授权的数据。",
        en: "D0 training manifest must not include blocked or unlicensed data.",
      },
      required: true,
      fulfilled: hasNoBlockedItems,
      tags: [
        "d0_requirement",
        "blocked_data_rejection",
        hasNoBlockedItems ? "fulfilled" : "blocked_items_present",
      ],
    },
  ]
}
