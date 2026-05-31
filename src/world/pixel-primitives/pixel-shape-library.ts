// 该文件用于定义由基础像素块组成的可复用像素形状。

import type { PixelShapeDefinition, PixelShapeId } from "./pixel-primitive-schema";

export const PIXEL_SHAPE_LIBRARY: Record<PixelShapeId, PixelShapeDefinition> = {
  leaf_row: { id: "leaf_row", label: "叶子横条", description: "用于树冠和灌木的横向叶片行。", primitiveKinds: ["wide_block", "highlight_block", "dark_block"] },
  leaf_cluster: { id: "leaf_cluster", label: "叶团", description: "由多条叶子横条叠成的树冠或灌木团块。", primitiveKinds: ["wide_block", "dark_block", "highlight_block"] },
  trunk_strip: { id: "trunk_strip", label: "树干条", description: "用于树干和木质竖向结构。", primitiveKinds: ["tall_block", "highlight_block", "dark_block"] },
  shadow_patch: { id: "shadow_patch", label: "投影块", description: "用于物体贴地阴影。", primitiveKinds: ["shadow_block"] },
  highlight_chip: { id: "highlight_chip", label: "高光碎片", description: "用于叶子、石头、昆虫和衣服上的局部高光。", primitiveKinds: ["highlight_block", "dot_block"] },
  grass_chip: { id: "grass_chip", label: "草点", description: "用于地面草尖和局部生态信号。", primitiveKinds: ["tall_block", "dot_block"] },
  soil_chip: { id: "soil_chip", label: "土点", description: "用于裸土、磨损和地面变化。", primitiveKinds: ["dot_block", "noise_block"] },
  worn_strip: { id: "worn_strip", label: "磨损条", description: "用于长期经过后的低草或裸土痕迹。", primitiveKinds: ["wide_block", "noise_block"] },
  pressed_mark: { id: "pressed_mark", label: "压痕", description: "用于轻微踩踏和地表压低。", primitiveKinds: ["wide_block", "dark_block"] },
  stone_cluster: { id: "stone_cluster", label: "石头团块", description: "用于不规则石头主体。", primitiveKinds: ["square_block", "wide_block", "dark_block", "highlight_block"] },
  wing_chip: { id: "wing_chip", label: "翅膀块", description: "用于小昆虫翅膀。", primitiveKinds: ["transparent_block", "line_block"] },
  leg_line: { id: "leg_line", label: "腿线", description: "用于昆虫腿和细小肢体。", primitiveKinds: ["line_block"] },
  antenna_line: { id: "antenna_line", label: "触角线", description: "用于昆虫触角。", primitiveKinds: ["line_block", "dot_block"] },
  body_cluster: { id: "body_cluster", label: "身体团块", description: "用于小生物身体主体。", primitiveKinds: ["square_block", "dot_block", "highlight_block"] },
  head_block: { id: "head_block", label: "头部块", description: "用于管家或小生物头部。", primitiveKinds: ["square_block", "highlight_block"] },
  cloth_panel: { id: "cloth_panel", label: "服装面板", description: "用于管家身体衣服。", primitiveKinds: ["wide_block", "tall_block", "highlight_block"] },
  arm_strip: { id: "arm_strip", label: "手臂条", description: "用于管家手臂。", primitiveKinds: ["tall_block", "line_block"] },
  leg_strip: { id: "leg_strip", label: "腿部条", description: "用于管家腿部。", primitiveKinds: ["tall_block"] },
};

export function listPixelShapeDefinitions(): PixelShapeDefinition[] {
  return Object.values(PIXEL_SHAPE_LIBRARY);
}
