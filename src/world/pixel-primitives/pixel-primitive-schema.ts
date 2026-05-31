// 该文件用于定义像素原型库的核心类型。

export type PixelPrimitiveKind =
  | "square_block"
  | "wide_block"
  | "tall_block"
  | "dot_block"
  | "line_block"
  | "shadow_block"
  | "highlight_block"
  | "dark_block"
  | "transparent_block"
  | "noise_block";

export type PixelShapeId =
  | "leaf_row"
  | "leaf_cluster"
  | "trunk_strip"
  | "shadow_patch"
  | "highlight_chip"
  | "grass_chip"
  | "soil_chip"
  | "worn_strip"
  | "pressed_mark"
  | "stone_cluster"
  | "wing_chip"
  | "leg_line"
  | "antenna_line"
  | "body_cluster"
  | "head_block"
  | "cloth_panel"
  | "arm_strip"
  | "leg_strip";

export type PixelPartId =
  | "tree_shadow"
  | "tree_trunk"
  | "tree_trunk_light"
  | "tree_crown_dark"
  | "tree_crown_main"
  | "tree_crown_highlight"
  | "tree_crown_under"
  | "ground_base"
  | "grass_detail"
  | "soil_detail"
  | "pressed_detail"
  | "worn_detail"
  | "stone_shadow"
  | "stone_body"
  | "stone_dark_edge"
  | "stone_highlight"
  | "insect_body"
  | "insect_head"
  | "insect_wing"
  | "insect_leg"
  | "insect_antenna"
  | "insect_highlight"
  | "butler_shadow"
  | "butler_leg"
  | "butler_body"
  | "butler_cloth"
  | "butler_arm"
  | "butler_head"
  | "butler_hair_or_hat"
  | "butler_accessory";

export type PixelObjectKind = "tree" | "grass_tile" | "stone" | "insect" | "butler";

export type PixelLayerKind =
  | "ground"
  | "trace"
  | "shadow"
  | "object"
  | "actor"
  | "foreground"
  | "atmosphere";

export type PixelAnchorType = "root_bottom" | "tile_origin" | "body_center" | "feet_center" | "center_bottom";

export type PixelValidationStatus = "pass" | "warn" | "fail";

export type PixelBlock = {
  id: string;
  primitiveKind: PixelPrimitiveKind;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  opacity: number;
  layer: PixelLayerKind;
};

export type PixelAnchor = {
  type: PixelAnchorType;
  x: number;
  y: number;
};

export type PixelBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PixelPrimitiveDefinition = {
  kind: PixelPrimitiveKind;
  label: string;
  description: string;
  defaultWidth: number;
  defaultHeight: number;
  defaultLayer: PixelLayerKind;
};

export type PixelShapeDefinition = {
  id: PixelShapeId;
  label: string;
  description: string;
  primitiveKinds: PixelPrimitiveKind[];
};

export type PixelPartDefinition = {
  id: PixelPartId;
  label: string;
  semanticRole: string;
  shapeIds: PixelShapeId[];
};

export type PixelSemanticStructure = {
  id: `${PixelObjectKind}_semantic_structure_v1`;
  objectKind: PixelObjectKind;
  label: string;
  anchorType: PixelAnchorType;
  requiredParts: PixelPartId[];
  optionalParts: PixelPartId[];
  forbiddenParts: string[];
  relationSummary: string;
};

export type PixelObjectValidation = {
  status: PixelValidationStatus;
  messages: string[];
};

export type PixelObjectRecipeResult = {
  kind: PixelObjectKind;
  label: string;
  recipeId: string;
  recipeVersion: string;
  goldenAlgorithm?: string;
  semanticStructureId: PixelSemanticStructure["id"];
  anchor: PixelAnchor;
  bounds: PixelBounds;
  blocks: PixelBlock[];
  usedPrimitives: PixelPrimitiveKind[];
  usedShapes: PixelShapeId[];
  usedParts: PixelPartId[];
  validation: PixelObjectValidation;
};
