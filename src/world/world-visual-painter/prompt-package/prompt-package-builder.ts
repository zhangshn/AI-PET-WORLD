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
  const highWeightRules = input.ruleDataset.rules
    .filter((rule) => rule.weight >= 4)
    .map((rule) => `${rule.rule.en} / ${rule.rule.zh}`)
    .join(" ")

  const mustShowZh = input.sceneIntent.mustShow
    .map((item) => item.zh)
    .join("；")
  const mustShowEn = input.sceneIntent.mustShow
    .map((item) => item.en)
    .join("; ")
  const mayShowZh = input.sceneIntent.mayShow
    .map((item) => item.zh)
    .join("；")
  const mayShowEn = input.sceneIntent.mayShow
    .map((item) => item.en)
    .join("; ")
  const mustNotShowZh = input.sceneIntent.mustNotShow
    .map((item) => item.zh)
    .join("；")
  const mustNotShowEn = input.sceneIntent.mustNotShow
    .map((item) => item.en)
    .join("; ")

  const styleTargetZh = WORLD_VISUAL_MVP_TARGET_POLICY.styleDirection
    .map((item) => item.zh)
    .join(" ")
  const styleTargetEn = WORLD_VISUAL_MVP_TARGET_POLICY.styleDirection
    .map((item) => item.en)
    .join(" ")

  return {
    packageId: `prompt-package-${input.factManifest.worldId}-${input.factManifest.tick}`,
    modelRole: "ai_image_generation_model",
    positivePrompt: {
      zh: [
        "生成一张原创、高质量、明亮治愈、精细、俯视像素风的静态世界位图。",
        "这是一张玩家最终可能看到的世界画面候选图，不是程序草图，不是 SVG，不是 Canvas，不是调试图，不是占位图。",
        `风格目标：${styleTargetZh}`,
        `场景意图：${input.sceneIntent.mainStory.zh}`,
        `必须出现：${mustShowZh}`,
        `可以作为视觉细节出现：${mayShowZh}`,
        `构图要求：${input.compositionPlan.focalArea.zh} ${input.compositionPlan.background.zh} ${input.compositionPlan.midground.zh} ${input.compositionPlan.foreground.zh} ${input.compositionPlan.edgeFraming.zh}`,
        `地形要求：${input.terrainPlan.groundTexture.zh} ${input.terrainPlan.pathStrategy.zh} ${input.terrainPlan.waterStrategy.zh} ${input.terrainPlan.elevationStrategy.zh}`,
        `资产要求：${input.assetPlan.constructionFocus.zh} ${input.assetPlan.natureLayers.map((item) => item.zh).join(" ")} ${input.assetPlan.materialLayers.map((item) => item.zh).join(" ")}`,
        `施工和材料关系：${input.assetPlan.blockedPlaceholderPolicy.zh}`,
        `动态层说明：${input.motionPlan.reason.zh}`,
        "画面必须有清晰世界主焦点、自然地形层次、合理路径逻辑、自然边界、材料与施工关系。",
        "允许补充草叶、碎石、花丛、边缘阴影、像素纹理等轻量视觉细节，但不能新增重大世界事实。",
        `高权重视觉规则：${highWeightRules}`,
        "原创安全：只能使用项目授权素材、抽象设计原则和当前世界事实，不能复制任何未授权第三方作品、角色、标志、截图、地图结构或独特像素表达。",
      ].join(" "),
      en: [
        "Create an original, high-quality, bright, healing, detailed, top-down pixel-art static world bitmap.",
        "This is a candidate for the final player-visible world frame, not a program sketch, SVG, Canvas, debug image, or placeholder.",
        `Style target: ${styleTargetEn}`,
        `Scene intent: ${input.sceneIntent.mainStory.en}`,
        `Must include: ${mustShowEn}`,
        `May include as visual details: ${mayShowEn}`,
        `Composition requirements: ${input.compositionPlan.focalArea.en} ${input.compositionPlan.background.en} ${input.compositionPlan.midground.en} ${input.compositionPlan.foreground.en} ${input.compositionPlan.edgeFraming.en}`,
        `Terrain requirements: ${input.terrainPlan.groundTexture.en} ${input.terrainPlan.pathStrategy.en} ${input.terrainPlan.waterStrategy.en} ${input.terrainPlan.elevationStrategy.en}`,
        `Asset requirements: ${input.assetPlan.constructionFocus.en} ${input.assetPlan.natureLayers.map((item) => item.en).join(" ")} ${input.assetPlan.materialLayers.map((item) => item.en).join(" ")}`,
        `Construction and material relationship: ${input.assetPlan.blockedPlaceholderPolicy.en}`,
        `Motion layer note: ${input.motionPlan.reason.en}`,
        "The frame must have a clear world focal point, natural terrain layering, coherent path logic, natural boundaries, and readable material/construction relationships.",
        "Light visual details such as grass blades, small stones, flowers, edge shadows, and pixel textures may be added, but major world facts must not be added.",
        `High-priority visual rules: ${highWeightRules}`,
        "Originality safety: use only project-authorized assets, abstract design principles, and current world facts. Do not copy any unlicensed third-party work, character, logo, screenshot, map structure, or distinctive pixel expression.",
      ].join(" "),
    },
    negativePrompt: {
      zh: [
        "不要生成低质量、低细节、空旷单色草地、纯色块铺底、粗糙方块、程序矩形、SVG 拼图感、Canvas 调试图感。",
        "不要生成随机散点、脏路径、断裂路径、无逻辑道路、乱码文字、水印、UI 卡片、调试框、边框按钮、图标菜单。",
        "不要生成真实照片风、3D 渲染风、模糊插画感、过度写实、镜头景深、现代城市、科幻建筑、商业街区。",
        `禁止出现：${mustNotShowZh}`,
        "不要新增世界事实中不存在的角色、宠物、NPC、大型建筑、道路系统、桥梁系统、剧情事件或文明结果。",
        "不要复制任何未授权第三方作品的构图、角色、建筑、像素块、地图结构、UI、标志或独特表达。",
      ].join(" "),
      en: [
        "Avoid low quality, low detail, empty flat green fields, flat color fill, rough blocks, programmatic rectangles, SVG collage look, and Canvas debug image look.",
        "Avoid random scatter, muddy paths, broken paths, illogical roads, garbled text, watermarks, UI cards, debug boxes, borders, buttons, icon menus.",
        "Avoid photorealism, 3D render style, blurry illustration look, excessive realism, camera depth of field, modern cities, sci-fi buildings, and commercial districts.",
        `Must not include: ${mustNotShowEn}`,
        "Do not add characters, pets, NPCs, large buildings, road systems, bridge systems, story events, or civilization outcomes that do not exist in world facts.",
        "Do not copy any unlicensed third-party work's composition, characters, buildings, pixel clusters, map structure, UI, logo, or distinctive expression.",
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
      "must_include_bound",
      "must_not_include_bound",
      "visual_fix_ready",
      "copyright_safe_prompting",
      "not_player_visible",
    ],
  }
}