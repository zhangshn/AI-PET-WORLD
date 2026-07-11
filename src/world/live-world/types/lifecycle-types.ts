export type TreeStage =
  | "seed"
  | "sprout"
  | "young"
  | "mature"
  | "stump"
  | "dead";

export type RockStage =
  | "small"
  | "medium"
  | "large"
  | "mined"
  | "depleted";

export type GrassClumpStage =
  | "young"
  | "mature"
  | "harvested"
  | "recovering";

export type FlowerStage =
  | "bud"
  | "blooming"
  | "picked"
  | "recovering";

export type BerryBushStage =
  | "young"
  | "mature_no_fruit"
  | "fruiting"
  | "harvested"
  | "recovering";

export type ReedStage =
  | "young"
  | "mature"
  | "cut"
  | "recovering";

export type LifecycleStage =
  | TreeStage
  | RockStage
  | GrassClumpStage
  | FlowerStage
  | BerryBushStage
  | ReedStage;

export interface TreeLifecycle {
  type: "tree";
  stage: TreeStage;
  ageTicks: number;
  nextStageTick?: number;
}

export interface RockLifecycle {
  type: "rock";
  stage: RockStage;
  durability: number;
}

export interface GrassClumpLifecycle {
  type: "grass_clump";
  stage: GrassClumpStage;
  ageTicks: number;
  nextRegenTick?: number;
}

export interface FlowerLifecycle {
  type: "flower";
  stage: FlowerStage;
  ageTicks: number;
  nextRegenTick?: number;
}

export interface BerryBushLifecycle {
  type: "berry_bush";
  stage: BerryBushStage;
  ageTicks: number;
  nextFruitTick?: number;
}

export interface ReedLifecycle {
  type: "reed";
  stage: ReedStage;
  ageTicks: number;
  nextRegenTick?: number;
}

export type EntityLifecycle =
  | TreeLifecycle
  | RockLifecycle
  | GrassClumpLifecycle
  | FlowerLifecycle
  | BerryBushLifecycle
  | ReedLifecycle;

