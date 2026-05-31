// 该文件用于定义由像素形状组成的物体部件。

import type { PixelPartDefinition, PixelPartId } from "./pixel-primitive-schema";

export const PIXEL_PART_LIBRARY: Record<PixelPartId, PixelPartDefinition> = {
  tree_shadow: { id: "tree_shadow", label: "树影", semanticRole: "树根下方的贴地阴影。", shapeIds: ["shadow_patch"] },
  tree_trunk: { id: "tree_trunk", label: "树干", semanticRole: "从根部向上生长的木质主体。", shapeIds: ["trunk_strip"] },
  tree_trunk_light: { id: "tree_trunk_light", label: "树干高光", semanticRole: "树干侧边的亮面。", shapeIds: ["highlight_chip"] },
  tree_crown_dark: { id: "tree_crown_dark", label: "树冠暗部", semanticRole: "树冠后层和底部暗面。", shapeIds: ["leaf_cluster"] },
  tree_crown_main: { id: "tree_crown_main", label: "树冠主体", semanticRole: "主要叶团轮廓。", shapeIds: ["leaf_cluster", "leaf_row"] },
  tree_crown_highlight: { id: "tree_crown_highlight", label: "树冠高光", semanticRole: "树冠上方的浅色叶片。", shapeIds: ["leaf_row", "highlight_chip"] },
  tree_crown_under: { id: "tree_crown_under", label: "树冠底部暗部", semanticRole: "树冠下缘压暗轮廓。", shapeIds: ["leaf_cluster"] },
  ground_base: { id: "ground_base", label: "地面底色", semanticRole: "草地 tile 的基础底色。", shapeIds: ["grass_chip"] },
  grass_detail: { id: "grass_detail", label: "草地细节", semanticRole: "少量草尖和生态细节。", shapeIds: ["grass_chip"] },
  soil_detail: { id: "soil_detail", label: "土点细节", semanticRole: "裸土或地面变化。", shapeIds: ["soil_chip"] },
  pressed_detail: { id: "pressed_detail", label: "压痕细节", semanticRole: "轻度踩踏形成的压低痕迹。", shapeIds: ["pressed_mark"] },
  worn_detail: { id: "worn_detail", label: "磨损细节", semanticRole: "长期使用后形成的磨损痕迹。", shapeIds: ["worn_strip"] },
  stone_shadow: { id: "stone_shadow", label: "石头阴影", semanticRole: "石头底部贴地阴影。", shapeIds: ["shadow_patch"] },
  stone_body: { id: "stone_body", label: "石头主体", semanticRole: "不规则石头主体。", shapeIds: ["stone_cluster"] },
  stone_dark_edge: { id: "stone_dark_edge", label: "石头暗边", semanticRole: "石头底部和背光边缘。", shapeIds: ["stone_cluster"] },
  stone_highlight: { id: "stone_highlight", label: "石头高光", semanticRole: "石头上方亮面。", shapeIds: ["highlight_chip"] },
  insect_body: { id: "insect_body", label: "昆虫身体", semanticRole: "昆虫中心主体。", shapeIds: ["body_cluster"] },
  insect_head: { id: "insect_head", label: "昆虫头部", semanticRole: "贴近身体前方的小头部。", shapeIds: ["head_block"] },
  insect_wing: { id: "insect_wing", label: "昆虫翅膀", semanticRole: "贴在身体两侧的半透明翅膀。", shapeIds: ["wing_chip"] },
  insect_leg: { id: "insect_leg", label: "昆虫腿", semanticRole: "身体两侧的细线腿。", shapeIds: ["leg_line"] },
  insect_antenna: { id: "insect_antenna", label: "昆虫触角", semanticRole: "头部前上方的触角。", shapeIds: ["antenna_line"] },
  insect_highlight: { id: "insect_highlight", label: "昆虫高光", semanticRole: "身体或翅膀上的小亮点。", shapeIds: ["highlight_chip"] },
  butler_shadow: { id: "butler_shadow", label: "管家阴影", semanticRole: "管家脚底下方贴地阴影。", shapeIds: ["shadow_patch"] },
  butler_leg: { id: "butler_leg", label: "管家腿部", semanticRole: "从脚底向上的腿部结构。", shapeIds: ["leg_strip"] },
  butler_body: { id: "butler_body", label: "管家身体", semanticRole: "腿部上方的人形身体。", shapeIds: ["cloth_panel"] },
  butler_cloth: { id: "butler_cloth", label: "管家服装", semanticRole: "覆盖身体的服装面板。", shapeIds: ["cloth_panel", "highlight_chip"] },
  butler_arm: { id: "butler_arm", label: "管家手臂", semanticRole: "身体两侧的手臂。", shapeIds: ["arm_strip"] },
  butler_head: { id: "butler_head", label: "管家头部", semanticRole: "身体上方的头部。", shapeIds: ["head_block"] },
  butler_hair_or_hat: { id: "butler_hair_or_hat", label: "管家发型或帽子", semanticRole: "头部上方的简单发型或帽子占位。", shapeIds: ["cloth_panel"] },
  butler_accessory: { id: "butler_accessory", label: "管家配饰", semanticRole: "后续人格视觉差异的配饰占位。", shapeIds: ["highlight_chip"] },
};

export function listPixelPartDefinitions(): PixelPartDefinition[] {
  return Object.values(PIXEL_PART_LIBRARY);
}
