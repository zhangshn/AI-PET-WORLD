// This file defines the formal input and output contracts for pixel scene composition.

export type SceneComposerBiome = "forest" | "grassland" | "desert" | "oasis";

export type SceneTraceKind = "movement" | "spatial_use" | "ecology" | "world";

export type SceneTraceFact = {
  id: string;
  kind: SceneTraceKind;
  strength: number;
  age: number;
  radius?: number;
  x?: number;
  y?: number;
};

export type SceneTraceSample = {
  column: number;
  center: number;
  x: number;
  topY: number;
  bottomY: number;
};

export type SceneTraceField = {
  kind: SceneTraceKind;
  traceShape: number;
  traceDensity: number;
  hasTraceFact: boolean;
  facts: SceneTraceFact[];
  samples: SceneTraceSample[];
  averageInfluence?: number;
  maxInfluence?: number;
  influencedTiles?: number;
  movementInfluencedTiles?: number;
  spatialUseInfluencedTiles?: number;
  ecologyInfluencedTiles?: number;
  averageMovementInfluence?: number;
  averageEcologyInfluence?: number;
  averageSpatialUseInfluence?: number;
};

export type SceneComposerFact = {
  id: string;
  biome: SceneComposerBiome;
  moisture: number;
  decorationDensity: number;
  traceShape: number;
  traceDensity: number;
  worldSeed: string;
  hasTraceFact?: boolean;
  traceFacts?: SceneTraceFact[];
  /** @deprecated Use traceShape. Kept only for legacy caller compatibility. */
  roadShape?: number;
  /** @deprecated Use hasTraceFact. Kept only for legacy caller compatibility. */
  hasRoadFact?: boolean;
  includeActorPlaceholder?: boolean;
  factObjects?: SceneObject[];
};

/** @deprecated The visual tile name is retained for renderer compatibility. */
export type SceneTileKind = "grass" | "path" | "edge";

export type SceneObjectKind = "tree" | "bush" | "stone" | "flower" | "actor";

export type SceneObjectLayer = "back" | "middle" | "front";

export type ScenePalette = {
  bg: string;
  grassA: string;
  grassB: string;
  grassC: string;
  grassDark: string;
  grassLight: string;
  pathA: string;
  pathB: string;
  pathDark: string;
  pathLight: string;
  shadow: string;
  trunkDark: string;
  trunk: string;
  trunkLight: string;
  leafDark: string;
  leaf: string;
  leafLight: string;
  leafUnder: string;
  bushDark: string;
  bush: string;
  bushLight: string;
  stone: string;
  stoneLight: string;
  flower: string;
  actorDark: string;
  actor: string;
};

/** @deprecated Use SceneTraceSample. */
export type PathSample = SceneTraceSample;

export type SceneAnchor = {
  id: string;
  x: number;
  y: number;
  rank: number;
  roll: number;
  scaleRoll: number;
  ageRoll: number;
  healthRoll: number;
};

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
  longUsedAreaTiles: number;
  traceEdgeTiles: number;
  /**
   * @deprecated Legacy visual tile name compatibility only.
   * This is not a formal business concept; use longUsedAreaTiles.
   */
  pathTiles: number;
  /**
   * @deprecated Legacy visual edge name compatibility only.
   * Use traceEdgeTiles, or describe it as ecology transition.
   */
  edgeTiles: number;
  traceInfluencedTiles: number;
  movementInfluencedTiles: number;
  spatialUseInfluencedTiles: number;
  ecologyInfluencedTiles: number;
  traceSuppressedGrassTufts: number;
  traceAvoidedGeneratedObjects: number;
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
  traceShape: number;
  traceDensity: number;
  hasTraceFact: boolean;
  traceFacts: SceneTraceFact[];
  traceSamples: SceneTraceSample[];
  traceField: SceneTraceField;
  /** @deprecated Use traceShape. Kept only for legacy caller compatibility. */
  roadShape?: number;
  /** @deprecated Use hasTraceFact. Kept only for legacy caller compatibility. */
  hasRoadFact?: boolean;
  tiles: SceneTile[];
  grassTufts: SceneGrassTuft[];
  factObjects: SceneObject[];
  generatedObjects: SceneObject[];
  objects: SceneObject[];
  summary: SceneCompositionSummary;
};
