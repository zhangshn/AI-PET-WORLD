import type {
  WorldVisualFactManifest,
  WorldVisualMotionPlan,
} from "../world-visual-painter-schema"

export function buildWorldVisualMotionPlan(
  manifest: WorldVisualFactManifest
): WorldVisualMotionPlan {
  return {
    enabled: false,
    plannedLayers: [
      {
        zh: "后续动态层：人物、动物、施工尘土、树叶、水面和光影。",
        en: "Future motion layers: characters, animals, construction dust, leaves, water, and light.",
      },
    ],
    reason: {
      zh: "MVP 当前先完成静态 ApprovedFrame。动态必须在静态画面审核通过后叠加。",
      en: "MVP first completes a static ApprovedFrame. Motion layers must be added only after static review passes.",
    },
    sourceFactIds: manifest.sourceFactIds,
    tags: ["motion_plan", "disabled_until_static_approved"],
  }
}
