import type { WorldVisualRuleDataset } from "../world-visual-painter-schema"

export const WORLD_VISUAL_MVP_RULE_DATASET: WorldVisualRuleDataset = {
  datasetId: "world-visual-rule-dataset-mvp-static-world-v1",
  version: "mvp-static-world-v1",
  sources: [
    {
      id: "source-user-approved-target-image-principles",
      title: {
        zh: "用户确认的 MVP 目标图原则",
        en: "User-approved MVP target image principles",
      },
      sourceKind: "self_made_reference",
      license: "self_owned",
      usage: "rule_extraction_only",
      canTrainOnImagePixels: false,
      canExtractRules: true,
      mustAvoidDirectCopy: true,
      notes: {
        zh: "当前阶段只提炼构图、层次、密度、光色、细节原则，不把参考图像素当作可复制素材。",
        en: "At this stage, only composition, depth, density, lighting, color, and detail principles are extracted. Reference pixels are not treated as copyable assets.",
      },
      tags: ["mvp_target", "rule_source", "do_not_copy_pixels"],
    },
    {
      id: "source-public-pixel-art-design-principles",
      title: {
        zh: "公开像素美术设计原则",
        en: "Public pixel art design principles",
      },
      sourceKind: "public_style_principle",
      license: "public_design_principle_only",
      usage: "style_principle_only",
      canTrainOnImagePixels: false,
      canExtractRules: true,
      mustAvoidDirectCopy: true,
      notes: {
        zh: "只使用公开、通用、抽象的设计原则，例如主次、留白、边缘包围、色彩层次、重复与变化。",
        en: "Only public, general, abstract design principles are used, such as focal hierarchy, negative space, edge framing, color depth, repetition and variation.",
      },
      tags: ["public_principle", "abstract_rule_only"],
    },
    {
      id: "source-unlicensed-third-party-art",
      title: {
        zh: "未授权第三方图片",
        en: "Unlicensed third-party artwork",
      },
      sourceKind: "blocked_reference",
      license: "blocked_unknown_or_unlicensed",
      usage: "blocked",
      canTrainOnImagePixels: false,
      canExtractRules: false,
      mustAvoidDirectCopy: true,
      notes: {
        zh: "不能导入训练，不能复制，不能作为素材库。只能在获得明确授权后重新登记。",
        en: "Do not import for training, copy, or use as an asset library. It may only be registered after explicit permission is obtained.",
      },
      tags: ["blocked", "copyright_safety"],
    },
  ],
  rules: [
    {
      id: "rule-composition-clear-primary-focus",
      category: "composition",
      rule: {
        zh: "画面必须有清晰主焦点，MVP 第一张图以世界建设核心区域为主焦点。",
        en: "The image must have a clear primary focal point. The MVP first frame uses the core world-building area as the focal point.",
      },
      auditSignal: {
        zh: "主焦点是否第一眼可读；是否被随机自然元素淹没。",
        en: "Whether the focal point is immediately readable and not buried by random natural elements.",
      },
      weight: 5,
      sourceDataIds: [
        "source-user-approved-target-image-principles",
        "source-public-pixel-art-design-principles",
      ],
      tags: ["mvp", "focal_point"],
    },
    {
      id: "rule-terrain-edge-framing",
      category: "terrain",
      rule: {
        zh: "树、深草、石头、水岸等自然边界应主要服务于边缘包围和空间层次，不能随机铺满整张图。",
        en: "Trees, deep grass, rocks, and shorelines should mainly support edge framing and spatial depth, not randomly cover the whole image.",
      },
      auditSignal: {
        zh: "边缘是否形成自然包围；中心是否留给可读场景。",
        en: "Whether edges form natural framing and the center remains readable.",
      },
      weight: 5,
      sourceDataIds: [
        "source-user-approved-target-image-principles",
        "source-public-pixel-art-design-principles",
      ],
      tags: ["mvp", "edge_framing"],
    },
    {
      id: "rule-path-readable-connection",
      category: "composition",
      rule: {
        zh: "路径必须连接入口、建设点、水岸或材料点，不能是无意义的脏线。",
        en: "Paths must connect entrances, construction areas, shoreline, or material points. They must not look like meaningless dirty strokes.",
      },
      auditSignal: {
        zh: "路径是否有起点、终点和目的；是否破坏场景可读性。",
        en: "Whether paths have origin, destination, and purpose, and whether they preserve scene readability.",
      },
      weight: 5,
      sourceDataIds: ["source-user-approved-target-image-principles"],
      tags: ["mvp", "path_logic"],
    },
    {
      id: "rule-asset-density-layered-not-flat",
      category: "asset_density",
      rule: {
        zh: "细节密度要分层：中心精细、边缘丰富、空地有纹理，但不能变成平铺噪点。",
        en: "Detail density must be layered: detailed center, rich edges, textured open ground, but not tiled noise.",
      },
      auditSignal: {
        zh: "是否有前中后景；草地是否有纹理而不是单色大块。",
        en: "Whether foreground, midground, and background exist, and whether grassland has texture instead of flat blocks.",
      },
      weight: 4,
      sourceDataIds: [
        "source-user-approved-target-image-principles",
        "source-public-pixel-art-design-principles",
      ],
      tags: ["mvp", "detail_density"],
    },
    {
      id: "rule-color-bright-healing",
      category: "color",
      rule: {
        zh: "颜色应明亮、治愈、自然，使用多层绿色、暖色路径和清晰光影。",
        en: "Colors should be bright, healing, and natural, using layered greens, warm paths, and clear lighting.",
      },
      auditSignal: {
        zh: "是否偏灰、偏脏、偏单调；是否有光照层次。",
        en: "Whether the image is gray, muddy, monotonous, and whether it has lighting depth.",
      },
      weight: 4,
      sourceDataIds: ["source-user-approved-target-image-principles"],
      tags: ["mvp", "color"],
    },
    {
      id: "rule-copyright-no-direct-copy",
      category: "copyright_safety",
      rule: {
        zh: "不能直接复制未授权图片、角色、建筑、构图或像素块；只能使用授权数据或抽象原则。",
        en: "Do not directly copy unlicensed images, characters, buildings, compositions, or pixel clusters. Use licensed data or abstract principles only.",
      },
      auditSignal: {
        zh: "是否存在过度贴近某张外部作品的构图、资产形状、角色或独特表达。",
        en: "Whether the result is too close to an external work's composition, asset shapes, characters, or distinctive expression.",
      },
      weight: 5,
      sourceDataIds: [
        "source-public-pixel-art-design-principles",
        "source-unlicensed-third-party-art",
      ],
      tags: ["copyright_safety", "hard_gate"],
    },
    {
      id: "rule-display-approved-frame-only",
      category: "display_gate",
      rule: {
        zh: "只有 AI 位图候选图通过 Visual Judge 并生成 ApprovedFrame 后，玩家才能看到画面。",
        en: "Players may only see an image after an AI bitmap candidate passes Visual Judge and becomes ApprovedFrame.",
      },
      auditSignal: {
        zh: "是否绕过审核展示了草图、蓝图、占位图或未审核候选图。",
        en: "Whether sketches, blueprints, placeholders, or unreviewed candidates are displayed by bypassing review.",
      },
      weight: 5,
      sourceDataIds: ["source-user-approved-target-image-principles"],
      tags: ["display_gate", "hard_gate"],
    },
  ],
  blockedSourceCount: 1,
  trainableSourceCount: 0,
  ruleExtractionSourceCount: 2,
  tags: [
    "visual_rule_dataset",
    "mvp_static_world",
    "copyright_safe",
    "rule_extraction_first",
  ],
}
