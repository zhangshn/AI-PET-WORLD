import type {
  WorldVisualAssetPlan,
  WorldVisualFactManifest,
} from "../world-visual-painter-schema"

export function buildWorldVisualAssetPlan(
  manifest: WorldVisualFactManifest
): WorldVisualAssetPlan {
  return {
    constructionFocus: {
      zh: "施工内容需要是可识别的建设进度：地基、框架、材料、工具和工作痕迹，而不是抽象方块。",
      en: "Construction must read as real progress: foundation, frame, materials, tools, and work traces, not abstract blocks.",
    },
    natureLayers: [
      {
        zh: "树木和灌木按边界、视线和层次分组，不随机均匀铺点。",
        en: "Trees and shrubs are grouped by boundary, sightline, and depth instead of evenly random dots.",
      },
      {
        zh: "石头、花、草簇用来打破空地，但数量和位置要服务构图。",
        en: "Rocks, flowers, and grass clumps break empty land while still serving the composition.",
      },
    ],
    materialLayers: [
      {
        zh: "木材、石料、脚手架和工具要靠近施工区域，形成可信的建设逻辑。",
        en: "Wood, stone, scaffolding, and tools stay near construction to create believable building logic.",
      },
    ],
    blockedPlaceholderPolicy: {
      zh: "任何占位色块、未完成旧资产、无来源装饰都不能进入 ApprovedFrame。",
      en: "No placeholder block, unfinished old asset, or source-free decoration may enter ApprovedFrame.",
    },
    sourceFactIds: manifest.sourceFactIds,
    tags: ["asset_plan", "original_assets_required", "no_placeholder_display"],
  }
}
