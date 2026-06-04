export type PixelWorldLayerKind =
  | "tile"
  | "trace"
  | "object"
  | "sprite"
  | "atmosphere"
  | "ui";

export type PixelWorldTileKind =
  | "grass"
  | "soil"
  | "worn_grass"
  | "pressed_grass"
  | "empty";

export type PixelWorldObjectKind =
  | "tree"
  | "grass_tile"
  | "stone"
  | "insect"
  | "building"
  | "facility";

export type PixelWorldActorKind = "butler";

export type PixelWorldTraceKind =
  | "footprint"
  | "pressed_grass"
  | "bare_soil"
  | "maintenance"
  | "recovery"
  | "waiting_spot";

export type PixelWorldCanvas = {
  width: number;
  height: number;
  tileSize: number;
};

export type PixelWorldBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PixelWorldAnchor = {
  x: number;
  y: number;
  type: "center" | "center_bottom" | "tile_origin" | "root_bottom" | "body_center";
};

export type PixelWorldTile = {
  id: string;
  layer: "tile";
  kind: PixelWorldTileKind;
  x: number;
  y: number;
  tileX: number;
  tileY: number;
  variant: string;
  walkable: boolean;
  movementCost: number;
  moisture?: number;
  ecologyHealth?: number;
  pressure?: number;
};

export type PixelWorldTrace = {
  id: string;
  sourceId?: string;
  layer: "trace";
  kind: PixelWorldTraceKind;
  bounds: PixelWorldBounds;
  strength: number;
  opacity: number;
  age?: number;
};

export type PixelWorldObject = {
  id: string;
  layer: "object";
  kind: PixelWorldObjectKind;
  recipeId: string;
  bounds: PixelWorldBounds;
  anchor: PixelWorldAnchor;
  sortY: number;
  visible: boolean;
  stateTags?: string[];
};

export type PixelWorldActor = {
  id: string;
  layer: "sprite";
  kind: PixelWorldActorKind;
  bounds: PixelWorldBounds;
  anchor: PixelWorldAnchor;
  sortY: number;
  visible: boolean;
  stateTags?: string[];
};

export type PixelWorldAtmosphere = {
  id: string;
  layer: "atmosphere";
  kind: "time_light" | "weather_tint" | "season_tint" | "ecology_tint";
  opacity: number;
  intensity: number;
};

export type PixelWorldOverlay = {
  id: string;
  layer: "ui";
  kind: "p_phone" | "butler_hint" | "world_status";
  text?: string;
  visible: boolean;
};

export type PixelWorldViewModel = {
  worldId: string;
  tick: number;
  canvas: PixelWorldCanvas;
  tiles: PixelWorldTile[];
  traces: PixelWorldTrace[];
  objects: PixelWorldObject[];
  actors: PixelWorldActor[];
  atmosphere: PixelWorldAtmosphere[];
  overlays: PixelWorldOverlay[];
};
