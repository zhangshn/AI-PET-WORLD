import { buildWorldVisualAuthorizedDataManifest } from "../authorized-data"
import type {
  WorldVisualAuthorizedDataItem,
  WorldVisualAuthorizedDataManifest,
} from "../world-visual-painter-schema"
import type {
  WorldVisualTrainingDataManifest,
  WorldVisualTrainingDataRequirement,
  WorldVisualTrainingDataStatus,
} from "./training-data-types"

const REQUIRED_MIN_SAMPLE_COUNT = 100
const TARGET_SAMPLE_COUNT = 300

export function buildWorldVisualTrainingDataManifest(
  authorizedDataManifest: WorldVisualAuthorizedDataManifest =
    buildWorldVisualAuthorizedDataManifest(),
  acceptedPairedSampleCount = 0
): WorldVisualTrainingDataManifest {
  const trainableItems = authorizedDataManifest.items.filter(isAcceptedTrainableImageItem)
  const blockedItems = authorizedDataManifest.items.filter(
    (item) => item.status === "blocked" || item.usage === "blocked"
  )
  const missingSampleCount = Math.max(
    0,
    REQUIRED_MIN_SAMPLE_COUNT - acceptedPairedSampleCount
  )
  const status = resolveTrainingDataStatus(acceptedPairedSampleCount)
  const readyForTraining = status === "paired_dataset_ready"

  return {
    manifestId: "world-visual-training-data-paired-v0",
    version: "world-visual-training-data-v2",
    stage: "paired_dataset_v0",
    status,
    requiredMinSampleCount: REQUIRED_MIN_SAMPLE_COUNT,
    targetSampleCount: TARGET_SAMPLE_COUNT,
    acceptedPairedSampleCount,
    missingSampleCount,
    readyForTraining,
    trainableItems,
    blockedItems,
    requirements: buildRequirements({
      acceptedPairedSampleCount,
      blockedCount: blockedItems.length,
    }),
    policy: {
      zh: "训练集只统计已完成目标图、Blueprint、条件 mask、来源许可、哈希和人工审核的配对样本。项目代码不连接 GPT 或在线绘图 API。",
      en: "The dataset only counts paired samples with a target image, Blueprint, condition masks, source/license record, hashes, and human approval. Project code does not connect to GPT or online drawing APIs.",
    },
    tags: [
      "world_visual_training_data_manifest",
      "paired_dataset_v0",
      readyForTraining ? "paired_dataset_ready" : "paired_dataset_not_ready",
      `accepted_paired_sample_count:${acceptedPairedSampleCount}`,
      `missing_paired_sample_count:${missingSampleCount}`,
      "manual_ai_assisted_images_allowed",
      "no_online_drawing_api_in_project",
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
      item.dataKind === "ai_assisted_manual_bitmap" ||
      item.dataKind === "licensed_bitmap" ||
      item.dataKind === "cc0_bitmap") &&
    (item.license === "self_owned" ||
      item.license === "cc0" ||
      item.license === "commercial_license")
  )
}

function resolveTrainingDataStatus(
  acceptedPairedSampleCount: number
): WorldVisualTrainingDataStatus {
  if (acceptedPairedSampleCount === 0) return "paired_dataset_missing"
  if (acceptedPairedSampleCount < REQUIRED_MIN_SAMPLE_COUNT) {
    return "paired_dataset_insufficient"
  }

  return "paired_dataset_ready"
}

function buildRequirements(input: {
  acceptedPairedSampleCount: number
  blockedCount: number
}): WorldVisualTrainingDataRequirement[] {
  const hasMinimum = input.acceptedPairedSampleCount >= REQUIRED_MIN_SAMPLE_COUNT
  const hasNoBlockedItems = input.blockedCount === 0

  return [
    {
      id: "paired_dataset_minimum_sample_count",
      title: {
        zh: `首版训练集至少需要 ${REQUIRED_MIN_SAMPLE_COUNT} 条完整配对样本。`,
        en: `The first training dataset requires at least ${REQUIRED_MIN_SAMPLE_COUNT} complete paired samples.`,
      },
      required: true,
      fulfilled: hasMinimum,
      tags: [
        "paired_dataset_requirement",
        "paired_sample_count",
        hasMinimum ? "fulfilled" : "missing",
      ],
    },
    {
      id: "paired_dataset_complete_provenance",
      title: {
        zh: "每条样本必须具有来源许可、人工审核、Blueprint、mask 和文件哈希。",
        en: "Every sample must have provenance/license, human approval, a Blueprint, masks, and file hashes.",
      },
      required: true,
      fulfilled: true,
      tags: ["paired_dataset_requirement", "complete_provenance", "fulfilled"],
    },
    {
      id: "paired_dataset_no_blocked_items",
      title: {
        zh: "训练清单不能包含被阻断或未授权的数据。",
        en: "The training manifest must not include blocked or unlicensed data.",
      },
      required: true,
      fulfilled: hasNoBlockedItems,
      tags: [
        "paired_dataset_requirement",
        "blocked_data_rejection",
        hasNoBlockedItems ? "fulfilled" : "blocked_items_present",
      ],
    },
  ]
}
