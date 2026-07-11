export interface SizeInTiles {
  width: number;
  height: number;
}

export interface FootprintCell {
  dx: number;
  dy: number;
}

export interface CollisionState {
  blocksMovement: boolean;
  blocksVision: boolean;

  visualSize: SizeInTiles;

  movementFootprint: FootprintCell[];
  visionFootprint: FootprintCell[];
  interactionFootprint: FootprintCell[];

  collisionProfileId: string;
}

export interface CollisionCell {
  x: number;
  y: number;
  blocksMovement: boolean;
  blocksVision: boolean;
  sourceEntityIds: string[];
}

export interface WalkableCell {
  x: number;
  y: number;
  walkable: boolean;
  traversalCost: number;
}

export interface InteractionCell {
  x: number;
  y: number;
  interactableEntityIds: string[];
}

export interface CollisionProjectionResult {
  collisionLayer: CollisionCell[][];
  walkableLayer: WalkableCell[][];
  interactionLayer: InteractionCell[][];
}

