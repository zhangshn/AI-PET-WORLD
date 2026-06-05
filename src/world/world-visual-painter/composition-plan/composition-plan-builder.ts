import type {
  WorldVisualCompositionPlan,
  WorldVisualFactManifest,
} from "../world-visual-painter-schema"

export function buildWorldVisualCompositionPlan(
  manifest: WorldVisualFactManifest
): WorldVisualCompositionPlan {
  return {
    camera: "top_down_pixel_scene",
    focalArea: {
      zh: "主焦点放在施工空地或世界核心区域，玩家第一眼能知道发生了什么。",
      en: "Place the focal area on the construction clearing or world core so the player immediately understands the scene.",
    },
    background: {
      zh: "远处用树线、岩石和草地色块形成自然包围。",
      en: "Use tree lines, rocks, and grass patches to frame the distant background.",
    },
    midground: {
      zh: "中景承载主要建设、路径连接和材料关系。",
      en: "The midground carries construction, path connections, and material relationships.",
    },
    foreground: {
      zh: "前景用草、花、木桩、栏杆或水岸增加深度，但不能遮挡主事实。",
      en: "The foreground adds depth with grass, flowers, stumps, fences, or shoreline without hiding core facts.",
    },
    edgeFraming: {
      zh: "边缘必须像完整场景，不允许空绿底铺满屏幕。",
      en: "Edges must feel like a complete scene, never a flat green field filling the screen.",
    },
    sourceFactIds: manifest.sourceFactIds,
    tags: ["composition_plan", "world_first_scene"],
  }
}
