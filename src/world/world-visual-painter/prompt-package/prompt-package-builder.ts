import type {
  WorldVisualAssetPlan,
  WorldVisualCompositionPlan,
  WorldVisualFactManifest,
  WorldVisualMotionPlan,
  WorldVisualPromptPackage,
  WorldVisualRuleDataset,
  WorldVisualSceneIntent,
  WorldVisualTerrainPlan,
} from "../world-visual-painter-schema"
import { WORLD_VISUAL_MVP_TARGET_POLICY } from "../visual-target-policy"

export function buildWorldVisualPromptPackage(input: {
  factManifest: WorldVisualFactManifest
  sceneIntent: WorldVisualSceneIntent
  compositionPlan: WorldVisualCompositionPlan
  terrainPlan: WorldVisualTerrainPlan
  assetPlan: WorldVisualAssetPlan
  motionPlan: WorldVisualMotionPlan
  ruleDataset: WorldVisualRuleDataset
}): WorldVisualPromptPackage {
  const rules = input.ruleDataset.rules
    .filter((rule) => rule.weight >= 4)
    .map((rule) => `${rule.rule.en} / ${rule.rule.zh}`)
    .join(" ")

  return {
    packageId: `prompt-package-${input.factManifest.worldId}-${input.factManifest.tick}`,
    modelRole: "ai_image_generation_model",
    positivePrompt: {
      zh: [
        "生成一张原创、高质量、明亮治愈、俯视像素风的静态世界画面。",
        WORLD_VISUAL_MVP_TARGET_POLICY.styleDirection.map((item) => item.zh).join(" "),
        `场景意图：${input.sceneIntent.mainStory.zh}`,
        `构图：${input.compositionPlan.focalArea.zh} ${input.compositionPlan.edgeFraming.zh}`,
        `地形：${input.terrainPlan.groundTexture.zh} ${input.terrainPlan.pathStrategy.zh} ${input.terrainPlan.waterStrategy.zh}`,
        `资产：${input.assetPlan.constructionFocus.zh}`,
        `规则：${rules}`,
      ].join(" "),
      en: [
        "Create an original high-quality bright healing top-down pixel-art static world image.",
        WORLD_VISUAL_MVP_TARGET_POLICY.styleDirection.map((item) => item.en).join(" "),
        `Scene intent: ${input.sceneIntent.mainStory.en}`,
        `Composition: ${input.compositionPlan.focalArea.en} ${input.compositionPlan.edgeFraming.en}`,
        `Terrain: ${input.terrainPlan.groundTexture.en} ${input.terrainPlan.pathStrategy.en} ${input.terrainPlan.waterStrategy.en}`,
        `Assets: ${input.assetPlan.constructionFocus.en}`,
        `Rules: ${rules}`,
      ].join(" "),
    },
    negativePrompt: {
      zh: [
        "不要生成低质量、空旷单色草地、随机散点、脏路径、占位方块、乱码文字、水印、UI 卡片、现代城市、真实照片风、3D 渲染风。",
        "不要复制任何未授权第三方作品的构图、角色、建筑、像素块或独特表达。",
        "不要新增世界事实中不存在的角色、大型建筑、道路系统或剧情结果。",
      ].join(" "),
      en: [
        "Avoid low quality, empty flat green fields, random scatter, muddy paths, placeholder blocks, garbled text, watermarks, UI cards, modern cities, photorealism, and 3D render style.",
        "Do not copy any unlicensed third-party work's composition, characters, buildings, pixel clusters, or distinctive expression.",
        "Do not add characters, large buildings, road systems, or story outcomes that do not exist in world facts.",
      ].join(" "),
    },
    compositionGuide: input.compositionPlan.focalArea,
    terrainGuide: input.terrainPlan.groundTexture,
    assetGuide: input.assetPlan.constructionFocus,
    motionGuide: input.motionPlan.reason,
    ruleDataIds: input.ruleDataset.rules.map((rule) => rule.id),
    sourceFactIds: input.factManifest.sourceFactIds,
    canShowToPlayer: false,
    tags: [
      "prompt_package",
      "ai_image_generation_input",
      "world_facts_guided",
      "copyright_safe_prompting",
      "not_player_visible",
    ],
  }
}
