import { NextResponse } from "next/server"

import {
  buildWorldVisualAuthorizedDataManifest,
  WORLD_VISUAL_MVP_RULE_DATASET,
  WORLD_VISUAL_MVP_TARGET_POLICY,
} from "@/world/world-visual-painter"

export async function GET() {
  const authorizedDataManifest = buildWorldVisualAuthorizedDataManifest()
  const ruleDataset = WORLD_VISUAL_MVP_RULE_DATASET
  const acceptedItems = authorizedDataManifest.items.filter(
    (item) => item.status === "accepted"
  )
  const blockedItems = authorizedDataManifest.items.filter(
    (item) => item.status === "blocked"
  )
  const blockedRuleSources = ruleDataset.sources.filter(
    (source) => source.usage === "blocked"
  )
  const trainableSources = ruleDataset.sources.filter(
    (source) => source.canTrainOnImagePixels
  )
  const ruleOnlySources = ruleDataset.sources.filter(
    (source) => source.canExtractRules && !source.canTrainOnImagePixels
  )
  const highWeightRules = ruleDataset.rules.filter((rule) => rule.weight >= 4)
  const hardGateRules = ruleDataset.rules.filter((rule) =>
    rule.tags.includes("hard_gate")
  )
  const hasUnsafeTrainableSource = ruleDataset.sources.some(
    (source) =>
      source.canTrainOnImagePixels &&
      source.license !== "self_owned" &&
      source.license !== "cc0" &&
      source.license !== "commercial_license"
  )
  const blockedSourcesTrainable = ruleDataset.sources.some(
    (source) => source.usage === "blocked" && source.canTrainOnImagePixels
  )

  return NextResponse.json(
    {
      ok: !hasUnsafeTrainableSource && !blockedSourcesTrainable,
      targetPolicy: WORLD_VISUAL_MVP_TARGET_POLICY,
      authorizedDataManifest,
      ruleDataset,
      dataAudit: {
        acceptedItemCount: acceptedItems.length,
        blockedItemCount: blockedItems.length,
        acceptedTrainableCount: authorizedDataManifest.acceptedTrainableCount,
        acceptedRuleOnlyCount: authorizedDataManifest.acceptedRuleOnlyCount,
        blockedCount: authorizedDataManifest.blockedCount,
        trainableSourceCount: trainableSources.length,
        ruleOnlySourceCount: ruleOnlySources.length,
        blockedRuleSourceCount: blockedRuleSources.length,
        highWeightRuleCount: highWeightRules.length,
        hardGateRuleCount: hardGateRules.length,
        hasUnsafeTrainableSource,
        blockedSourcesTrainable,
        canShowToPlayer: false,
      },
      usageGate: {
        trainableSources: trainableSources.map((source) => ({
          id: source.id,
          title: source.title,
          license: source.license,
          usage: source.usage,
          canTrainOnImagePixels: source.canTrainOnImagePixels,
          canExtractRules: source.canExtractRules,
          mustAvoidDirectCopy: source.mustAvoidDirectCopy,
          tags: source.tags,
        })),
        ruleOnlySources: ruleOnlySources.map((source) => ({
          id: source.id,
          title: source.title,
          license: source.license,
          usage: source.usage,
          canTrainOnImagePixels: source.canTrainOnImagePixels,
          canExtractRules: source.canExtractRules,
          mustAvoidDirectCopy: source.mustAvoidDirectCopy,
          tags: source.tags,
        })),
        blockedRuleSources: blockedRuleSources.map((source) => ({
          id: source.id,
          title: source.title,
          license: source.license,
          usage: source.usage,
          canTrainOnImagePixels: source.canTrainOnImagePixels,
          canExtractRules: source.canExtractRules,
          mustAvoidDirectCopy: source.mustAvoidDirectCopy,
          tags: source.tags,
        })),
      },
      hardGateRules: hardGateRules.map((rule) => ({
        id: rule.id,
        category: rule.category,
        rule: rule.rule,
        auditSignal: rule.auditSignal,
        weight: rule.weight,
        sourceDataIds: rule.sourceDataIds,
        tags: rule.tags,
      })),
      safetyAudit: {
        canShowToPlayer: false,
        displayRule:
          "授权数据和视觉规则数据只用于 AI Painter 的约束、审核和 Prompt Package，不是世界画面。",
        displayRuleEn:
          "Authorized data and visual rule data are only for AI Painter constraints, review, and Prompt Package. They are not world frames.",
        noUnlicensedTrainingData:
          "未授权第三方图片不能训练、不能复制、不能作为素材库。",
        noUnlicensedTrainingDataEn:
          "Unlicensed third-party images cannot be trained on, copied, or used as an asset library.",
        publicDataRule:
          "公开资料只能提炼抽象设计原则，不能直接作为素材或训练图片。",
        publicDataRuleEn:
          "Public materials may only be used for abstract design principles, not directly as assets or training images.",
      },
      nextStep: {
        zh: "规则数据只参与 Director、WorldGenerationCondition、VisualJudge 和 VisualFix；正式画面仍必须来自内部模型位图候选图并通过 ApprovedFrame。",
        en: "Rule data only supports Director, WorldGenerationCondition, VisualJudge, and VisualFix. The formal frame must come from an internal-model bitmap candidate and become ApprovedFrame.",
      },
      canShowToPlayer: false,
      tags: [
        "world_visual_rule_data_api",
        "authorized_data_read_only",
        "visual_rule_dataset_read_only",
        "copyright_safety_audit",
        "not_player_visible",
        "does_not_generate",
        "does_not_modify_world_facts",
      ],
    },
    { status: hasUnsafeTrainableSource || blockedSourcesTrainable ? 422 : 200 }
  )
}
