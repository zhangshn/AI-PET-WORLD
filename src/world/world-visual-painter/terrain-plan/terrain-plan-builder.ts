import type {
  WorldVisualFactManifest,
  WorldVisualTerrainPlan,
} from "../world-visual-painter-schema"

export function buildWorldVisualTerrainPlan(
  manifest: WorldVisualFactManifest
): WorldVisualTerrainPlan {
  return {
    baseBiome: "green_forest_clearing",
    groundTexture: {
      zh: "草地要有明暗分区、草簇、花点和低频大色块，避免单一底色。",
      en: "Grass needs light/dark regions, clumps, flowers, and broad value patches instead of one flat base color.",
    },
    pathStrategy: {
      zh: "道路必须从世界事实推导，连向建设区、入口或水岸，形状要自然可读。",
      en: "Paths must derive from world facts, connect to construction, entrances, or shorelines, and remain readable.",
    },
    waterStrategy: {
      zh: "有水体事实时才表现水岸、码头、睡莲和石岸；没有事实时不能凭空增加。",
      en: "Show shorelines, docks, lilies, and bank stones only when water exists in facts.",
    },
    elevationStrategy: {
      zh: "地形高差用崖边、阴影和植被边界表达，但不改变世界事实。",
      en: "Express elevation with cliff edges, shadows, and vegetation boundaries without changing world facts.",
    },
    sourceFactIds: manifest.sourceFactIds,
    tags: ["terrain_plan", "fact_preserving_visual_expression"],
  }
}
