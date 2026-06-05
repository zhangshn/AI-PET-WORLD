import type {
  WorldVisualFactManifest,
  WorldVisualSceneIntent,
} from "../world-visual-painter-schema"

export function buildWorldVisualSceneIntent(
  manifest: WorldVisualFactManifest
): WorldVisualSceneIntent {
  const activeConstruction = manifest.constructionFacts.find((fact) =>
    ["active", "planned"].includes(fact.status)
  )
  const sceneType = manifest.hasConstructionState
    ? "forest_construction_clearing"
    : "world_foundation_hidden"
  const materialReadiness = manifest.resourceFact.materialReadiness
  const naturalGrowth = manifest.resourceFact.naturalGrowth

  return {
    sceneType,
    title:
      sceneType === "forest_construction_clearing"
        ? {
            zh: "森林施工空地",
            en: "Forest Construction Clearing",
          }
        : {
            zh: "世界基础画面待生成",
            en: "World Foundation Waiting For Painter",
          },
    mainStory: {
      zh: activeConstruction
        ? `画面必须表达真实世界事实：当前焦点是“${activeConstruction.title}”，施工区域、自然环境、路径和材料都要服务于这个建设故事。`
        : "画面必须表达真实世界事实：当前还没有通过审核的主建设画面，因此只能生成世界基础意图，不能展示未审核画面。",
      en: activeConstruction
        ? `The image must express real world facts: the current focus is ${activeConstruction.title}, and construction, nature, paths, and materials must support that story.`
        : "The image must express real world facts: no reviewed construction image exists yet, so only a foundation scene intent may be generated.",
    },
    mustShow: [
      {
        zh: activeConstruction
          ? `主焦点必须围绕建设计划：${activeConstruction.title}。`
          : "必须先建立清晰世界主焦点，而不是随机散点。",
        en: "One clear world focal point, not random scattered marks.",
      },
      {
        zh: "自然地形、施工区域、路径和环境层次之间必须有可读关系。",
        en: "A readable relationship between terrain, construction area, paths, and environment layers.",
      },
      {
        zh: `材料准备度 ${materialReadiness}、自然生长 ${naturalGrowth} 必须影响画面的材料密度和自然层次。`,
        en: `Material readiness ${materialReadiness} and natural growth ${naturalGrowth} must influence material density and nature layers.`,
      },
    ],
    mayShow: [
      {
        zh: "可展示原创像素视觉内容：树木、灌木、石块、水岸、材料堆、临时住所、施工痕迹。",
        en: "Original pixel visual content such as trees, shrubs, rocks, shoreline, material piles, temporary shelter, and construction traces.",
      },
    ],
    mustNotShow: [
      {
        zh: "不能展示未审核占位方块、脏路径、随机散点画面或任何未通过审核的视觉结果。",
        en: "Do not show unreviewed placeholder blocks, muddy paths, random scatter views, or any visual result that has not passed review.",
      },
    ],
    sourceFactIds: manifest.sourceFactIds,
    tags: ["scene_intent", sceneType],
  }
}
