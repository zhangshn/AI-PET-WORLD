import type { CollisionState } from "./collision-types";
import type {
  BerryBushLifecycle,
  FlowerLifecycle,
  GrassClumpLifecycle,
  ReedLifecycle,
  RockLifecycle,
  TreeLifecycle,
} from "./lifecycle-types";

export type InteractionKind =
  | "inspect"
  | "harvest"
  | "chop"
  | "mine"
  | "clear";

export interface InteractionState {
  enabled: boolean;
  kinds: InteractionKind[];
  cooldownUntilTick?: number;
}

export interface BaseWorldEntity {
  entityId: string;
  chunkId: string;

  tileX: number;
  tileY: number;

  widthTiles: number;
  heightTiles: number;

  collision: CollisionState;
  interaction: InteractionState;

  visualProfileId: string;
  sourceRuleId: string;

  createdTick: number;
  updatedTick: number;
}

export interface TreeEntity extends BaseWorldEntity {
  entityType: "tree";
  lifecycle: TreeLifecycle;
}

export interface RockEntity extends BaseWorldEntity {
  entityType: "rock";
  lifecycle: RockLifecycle;
}

export interface GrassClumpEntity extends BaseWorldEntity {
  entityType: "grass_clump";
  lifecycle: GrassClumpLifecycle;
}

export interface FlowerEntity extends BaseWorldEntity {
  entityType: "flower";
  lifecycle: FlowerLifecycle;
}

export interface BerryBushEntity extends BaseWorldEntity {
  entityType: "berry_bush";
  lifecycle: BerryBushLifecycle;
}

export interface ReedEntity extends BaseWorldEntity {
  entityType: "reed";
  lifecycle: ReedLifecycle;
}

export type WorldEntity =
  | TreeEntity
  | RockEntity
  | GrassClumpEntity
  | FlowerEntity
  | BerryBushEntity
  | ReedEntity;

