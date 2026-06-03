import type { PixelObjectKind, PixelSemanticStructure } from "./pixel-primitive-schema"

export const PIXEL_SEMANTIC_STRUCTURES: Record<PixelObjectKind, PixelSemanticStructure> = {
  tree: {
    id: "tree_semantic_structure_v1",
    objectKind: "tree",
    label: "树木语义结构",
    anchorType: "root_bottom",
    requiredParts: ["tree_shadow", "tree_trunk", "tree_crown_main"],
    optionalParts: [
      "tree_trunk_light",
      "tree_crown_dark",
      "tree_crown_highlight",
      "tree_crown_under",
    ],
    forbiddenParts: ["grass", "ground", "flower", "insect"],
    relationSummary:
      "树根为落点，阴影在根部下方，树干从根部向上，树冠覆盖树干上方，高光位于树冠上部。",
  },
  bush: {
    id: "bush_semantic_structure_v1",
    objectKind: "bush",
    label: "灌木语义结构",
    anchorType: "center_bottom",
    requiredParts: ["bush_shadow", "bush_main"],
    optionalParts: ["bush_dark", "bush_highlight"],
    forbiddenParts: ["tree_trunk", "tree_crown_main", "butler_body"],
    relationSummary:
      "灌木以底部中心为落点，阴影贴地，暗部在后层，主体叶团覆盖中部，高光只作为上缘少量点缀。",
  },
  flower: {
    id: "flower_semantic_structure_v1",
    objectKind: "flower",
    label: "花语义结构",
    anchorType: "center_bottom",
    requiredParts: ["flower_stem", "flower_bloom"],
    optionalParts: ["flower_shadow", "flower_leaf", "flower_highlight"],
    forbiddenParts: ["tree_trunk", "tree_crown_main", "stone_body", "butler_body"],
    relationSummary:
      "花以茎底部为落点，细茎向上连接花朵，花瓣围绕上端展开，少量叶片贴近茎部，阴影只作为贴地辅助。",
  },
  mushroom: {
    id: "mushroom_semantic_structure_v1",
    objectKind: "mushroom",
    label: "蘑菇语义结构",
    anchorType: "center_bottom",
    requiredParts: ["mushroom_stem", "mushroom_cap"],
    optionalParts: ["mushroom_shadow", "mushroom_spot", "mushroom_under"],
    forbiddenParts: ["tree_trunk", "tree_crown_main", "flower_bloom", "butler_body"],
    relationSummary:
      "蘑菇以菌柄底部为落点，菌柄支撑菌盖，菌盖横向展开并覆盖柄上方，斑点和底部暗面只作为局部细节。",
  },
  structure: {
    id: "structure_semantic_structure_v1",
    objectKind: "structure",
    label: "建筑语义结构",
    anchorType: "center_bottom",
    requiredParts: ["structure_base", "structure_wall", "structure_roof"],
    optionalParts: ["structure_shadow", "structure_door", "structure_window"],
    forbiddenParts: ["tree_crown_main", "flower_bloom", "mushroom_cap", "butler_head"],
    relationSummary:
      "建筑以底部中心为落点，地基贴地，墙体承载屋顶，门窗只作为外立面细节，不写入新的世界事实。",
  },
  facility: {
    id: "facility_semantic_structure_v1",
    objectKind: "facility",
    label: "设施语义结构",
    anchorType: "center_bottom",
    requiredParts: ["facility_base", "facility_body"],
    optionalParts: ["facility_shadow", "facility_accent", "facility_tool"],
    forbiddenParts: ["tree_trunk", "flower_bloom", "mushroom_cap", "butler_body"],
    relationSummary:
      "设施以底部中心为落点，底座贴地，主体表达功能性，工具与强调色只作为读图线索，不改变 runtime。",
  },
  grass_tile: {
    id: "grass_tile_semantic_structure_v1",
    objectKind: "grass_tile",
    label: "草地语义结构",
    anchorType: "tile_origin",
    requiredParts: ["ground_base", "grass_detail"],
    optionalParts: ["soil_detail", "pressed_detail", "worn_detail"],
    forbiddenParts: ["tree_trunk", "tree_crown_main", "insect_body", "butler_body"],
    relationSummary:
      "草地以 tile 原点为锚点，底色铺底，草点、土点、磨损和压痕作为局部细节，不形成独立对象。",
  },
  stone: {
    id: "stone_semantic_structure_v1",
    objectKind: "stone",
    label: "石头语义结构",
    anchorType: "center_bottom",
    requiredParts: ["stone_shadow", "stone_body"],
    optionalParts: ["stone_dark_edge", "stone_highlight"],
    forbiddenParts: ["tree_trunk", "tree_crown_main", "butler_head"],
    relationSummary:
      "石头以底部中心为落点，阴影贴地，主体略不规则，暗边在下部，高光在上方。",
  },
  insect: {
    id: "insect_semantic_structure_v1",
    objectKind: "insect",
    label: "昆虫语义结构",
    anchorType: "body_center",
    requiredParts: ["insect_body", "insect_head"],
    optionalParts: [
      "insect_wing",
      "insect_leg",
      "insect_antenna",
      "insect_highlight",
    ],
    forbiddenParts: ["tree_trunk", "ground_base", "butler_body"],
    relationSummary:
      "昆虫以身体中心为锚点，头部在前方，翅膀在两侧，腿和触角必须贴近身体或头部，整体保持小物种尺寸。",
  },
  butler: {
    id: "butler_semantic_structure_v1",
    objectKind: "butler",
    label: "管家语义结构",
    anchorType: "feet_center",
    requiredParts: ["butler_shadow", "butler_leg", "butler_body", "butler_head"],
    optionalParts: [
      "butler_cloth",
      "butler_arm",
      "butler_hair_or_hat",
      "butler_accessory",
    ],
    forbiddenParts: ["tree_trunk", "tree_crown_main", "ground_base"],
    relationSummary:
      "管家以脚底中心为锚点，阴影在脚下，腿连接身体，头在身体上方，衣服覆盖身体，手臂挂在身体两侧。",
  },
}

export function getPixelSemanticStructure(kind: PixelObjectKind): PixelSemanticStructure {
  return PIXEL_SEMANTIC_STRUCTURES[kind]
}
