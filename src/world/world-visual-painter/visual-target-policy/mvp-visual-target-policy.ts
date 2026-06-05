import type { WorldVisualMvpTargetPolicy } from "../world-visual-painter-schema"

export const WORLD_VISUAL_MVP_TARGET_POLICY: WorldVisualMvpTargetPolicy = {
  title: {
    zh: "MVP 第一张静态世界画面目标",
    en: "MVP First Static World Frame Target",
  },
  styleDirection: [
    {
      zh: "明亮、治愈、精细、俯视像素风。",
      en: "Bright, healing, detailed, top-down pixel art.",
    },
    {
      zh: "画面质量必须接近已确认的参考图标准：完整场景、层次丰富、主次清晰。",
      en: "Visual quality must approach the approved reference standard: complete scene, rich depth, and clear focus.",
    },
  ],
  imageMode: "static_world_frame",
  allowedWorldElements: [
    { zh: "自然空地", en: "natural clearing" },
    { zh: "水岸", en: "shoreline" },
    { zh: "草地", en: "grassland" },
    { zh: "树", en: "trees" },
    { zh: "石头", en: "rocks" },
    { zh: "花", en: "flowers" },
    { zh: "路径", en: "paths" },
    { zh: "材料", en: "materials" },
    { zh: "临时住所", en: "temporary shelter" },
  ],
  painterFreedom: {
    zh: "Painter 可以补充草簇、花点、小石头、阴影、光感、边缘植被等视觉细节，用来提高画面完整度和可读性。",
    en: "Painter may add grass clumps, flowers, small rocks, shadows, light accents, and edge vegetation as visual details to improve completeness and readability.",
  },
  forbiddenMajorFactCreation: {
    zh: "Painter 不能新增重大世界事实，例如不存在的大建筑、角色、道路系统、资源事件或剧情结果。",
    en: "Painter must not create major world facts such as nonexistent large buildings, actors, road systems, resource events, or story outcomes.",
  },
  displayGate: {
    zh: "审核没通过不能展示，测试阶段也不能例外。",
    en: "No image may be displayed until review passes, including during test stages.",
  },
  tags: [
    "mvp_visual_target_policy",
    "static_world_frame",
    "bright_healing_detailed_top_down_pixel",
    "approved_frame_required",
  ],
}
