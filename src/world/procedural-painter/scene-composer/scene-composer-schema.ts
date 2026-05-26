// 该文件定义像素世界场景组合器的正式输入与输出结构。

export type SceneComposerBiome = "forest" | "grassland" | "desert" | "oasis";

export type SceneComposerFact = {
  id: string;
  biome: SceneComposerBiome;
  moisture: number;
  decorationDensity: number;
  roadShape: number;
  worldSeed: string;
};

export type SceneTileKind = "grass" | "path" | "edge";

export type SceneObjectKind = "tree" | "bush" | "stone" | "flower" | "actor";

export type SceneObjectLayer = "back" | "middle" | "front";

export type SceneTile = {
  id: string;
  x: number;
  y: number;
  kind: SceneTileKind;
  variant: number;
  edgeMask?: "top" | "bottom";
};

export type SceneGrassTuft = {
  id: string;
  x: number;
  y: number;
  height: number;
  light: boolean;
  layer: SceneObjectLayer;
};

export type SceneObject = {
  id: string;
  kind: SceneObjectKind;
  x: number;
  y: number;
  scale: number;
  layer: SceneObjectLayer;
  health?: number;
  age?: number;
};

export type SceneCompositionSummary = {
  grassTiles: number;
  pathTiles: number;
  edgeTiles: number;
  grassTufts: number;
  trees: number;
  bushes: number;
  stones: number;
  flowers: number;
};

export type SceneCompositionPlan = {
  width: number;
  height: number;
  tileSize: number;
  biome: SceneComposerBiome;
  moisture: number;
  decorationDensity: number;
  roadShape: number;
  tiles: SceneTile[];
  grassTufts: SceneGrassTuft[];
  objects: SceneObject[];
  summary: SceneCompositionSummary;
};
