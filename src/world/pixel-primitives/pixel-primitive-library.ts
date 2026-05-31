// 该文件用于定义像素原型库的基础像素块。

import type { PixelPrimitiveDefinition, PixelPrimitiveKind } from "./pixel-primitive-schema";

export const PIXEL_PRIMITIVE_LIBRARY: Record<PixelPrimitiveKind, PixelPrimitiveDefinition> = {
  square_block: {
    kind: "square_block",
    label: "正方块",
    description: "用于主体、头部、石头局部和小型结构的基础方块。",
    defaultWidth: 8,
    defaultHeight: 8,
    defaultLayer: "object",
  },
  wide_block: {
    kind: "wide_block",
    label: "横条块",
    description: "用于叶子行、地面横向变化、衣服面板和宽形轮廓。",
    defaultWidth: 24,
    defaultHeight: 6,
    defaultLayer: "object",
  },
  tall_block: {
    kind: "tall_block",
    label: "竖条块",
    description: "用于树干、草尖、腿部和竖向结构。",
    defaultWidth: 6,
    defaultHeight: 24,
    defaultLayer: "object",
  },
  dot_block: {
    kind: "dot_block",
    label: "点块",
    description: "用于小高光、草点、土点、眼睛或生态小信号。",
    defaultWidth: 4,
    defaultHeight: 4,
    defaultLayer: "object",
  },
  line_block: {
    kind: "line_block",
    label: "细线块",
    description: "用于昆虫腿、触角、边缘线和细小连接。",
    defaultWidth: 12,
    defaultHeight: 2,
    defaultLayer: "object",
  },
  shadow_block: {
    kind: "shadow_block",
    label: "阴影块",
    description: "用于贴地阴影、底部暗色和对象落点。",
    defaultWidth: 32,
    defaultHeight: 10,
    defaultLayer: "shadow",
  },
  highlight_block: {
    kind: "highlight_block",
    label: "高光块",
    description: "用于叶片高光、石头高光、衣服亮边和小生物亮点。",
    defaultWidth: 8,
    defaultHeight: 4,
    defaultLayer: "object",
  },
  dark_block: {
    kind: "dark_block",
    label: "暗部块",
    description: "用于暗部、背光面和底部遮挡。",
    defaultWidth: 14,
    defaultHeight: 6,
    defaultLayer: "object",
  },
  transparent_block: {
    kind: "transparent_block",
    label: "半透明块",
    description: "用于昆虫翅膀、氛围和轻覆盖。",
    defaultWidth: 14,
    defaultHeight: 8,
    defaultLayer: "object",
  },
  noise_block: {
    kind: "noise_block",
    label: "细节噪点块",
    description: "用于少量地表细节，必须受密度规则限制。",
    defaultWidth: 3,
    defaultHeight: 3,
    defaultLayer: "ground",
  },
};

export function listPixelPrimitiveDefinitions(): PixelPrimitiveDefinition[] {
  return Object.values(PIXEL_PRIMITIVE_LIBRARY);
}
