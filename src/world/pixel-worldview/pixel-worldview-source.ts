import type {
  PixelWorldActorKind,
  PixelWorldAnchor,
  PixelWorldAtmosphere,
  PixelWorldBounds,
  PixelWorldObjectKind,
  PixelWorldTileKind,
  PixelWorldTraceKind,
} from "./pixel-worldview-types";

export type PixelWorldSourceTile = {
  id?: string;
  kind: PixelWorldTileKind;
  tileX: number;
  tileY: number;
  variant?: string;
  walkable?: boolean;
  movementCost?: number;
  moisture?: number;
  ecologyHealth?: number;
  pressure?: number;
};

export type PixelWorldSourceTrace = {
  id?: string;
  sourceId?: string;
  kind: PixelWorldTraceKind;
  bounds: PixelWorldBounds;
  strength?: number;
  opacity?: number;
  age?: number;
};

export type PixelWorldSourceObject = {
  id?: string;
  kind: PixelWorldObjectKind;
  recipeId: string;
  bounds: PixelWorldBounds;
  anchor: PixelWorldAnchor;
  sortY?: number;
  visible?: boolean;
  stateTags?: string[];
};

export type PixelWorldSourceActor = {
  id?: string;
  kind: PixelWorldActorKind;
  bounds: PixelWorldBounds;
  anchor: PixelWorldAnchor;
  sortY?: number;
  visible?: boolean;
  stateTags?: string[];
};

export type PixelWorldSourceSnapshot = {
  worldId: string;
  tick?: number;
  width?: number;
  height?: number;
  tileSize?: number;
  tiles?: PixelWorldSourceTile[];
  traces?: PixelWorldSourceTrace[];
  objects?: PixelWorldSourceObject[];
  actors?: PixelWorldSourceActor[];
  atmosphere?: PixelWorldAtmosphere[];
};
