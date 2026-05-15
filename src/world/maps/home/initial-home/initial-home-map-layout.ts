/**
 * 当前文件负责：汇总 MVP 初始家园地图的所有图层数据。
 */

import {
  INITIAL_HOME_MAP_COLUMNS,
  INITIAL_HOME_MAP_ID,
  INITIAL_HOME_MAP_NAME,
  INITIAL_HOME_MAP_ROWS,
  INITIAL_HOME_TILE_SIZE,
} from "./initial-home-map-constants"
import { INITIAL_HOME_ACTOR_LAYER } from "./layers/initial-home-actor-layer"
import { INITIAL_HOME_EDGE_LAYER } from "./layers/initial-home-edge-layer"
import { INITIAL_HOME_FACILITY_LAYER } from "./layers/initial-home-facility-layer"
import { INITIAL_HOME_GROUND_LAYER } from "./layers/initial-home-ground-layer"
import { INITIAL_HOME_NATURE_LAYER } from "./layers/initial-home-nature-layer"
import { INITIAL_HOME_PATH_LAYER } from "./layers/initial-home-path-layer"
import { INITIAL_HOME_STRUCTURE_LAYER } from "./layers/initial-home-structure-layer"
import { INITIAL_HOME_SURFACE_DECORATION_LAYER } from "./layers/initial-home-surface-decoration-layer"
import { INITIAL_HOME_ZONE_LAYER } from "./layers/initial-home-zone-layer"

export const INITIAL_HOME_MAP_LAYOUT = {
  id: INITIAL_HOME_MAP_ID,
  name: INITIAL_HOME_MAP_NAME,
  columns: INITIAL_HOME_MAP_COLUMNS,
  rows: INITIAL_HOME_MAP_ROWS,
  tileSize: INITIAL_HOME_TILE_SIZE,
  groundLayer: INITIAL_HOME_GROUND_LAYER,
  pathLayer: INITIAL_HOME_PATH_LAYER,
  edgeLayer: INITIAL_HOME_EDGE_LAYER,
  zoneLayer: INITIAL_HOME_ZONE_LAYER,
  structureLayer: INITIAL_HOME_STRUCTURE_LAYER,
  facilityLayer: INITIAL_HOME_FACILITY_LAYER,
  natureLayer: INITIAL_HOME_NATURE_LAYER,
  surfaceDecorationLayer: INITIAL_HOME_SURFACE_DECORATION_LAYER,
  actorLayer: INITIAL_HOME_ACTOR_LAYER,
} as const

export const INITIAL_HOME_SPRITE_LAYERS = [
  INITIAL_HOME_EDGE_LAYER,
  INITIAL_HOME_ZONE_LAYER,
  INITIAL_HOME_STRUCTURE_LAYER,
  INITIAL_HOME_FACILITY_LAYER,
  INITIAL_HOME_NATURE_LAYER,
  INITIAL_HOME_SURFACE_DECORATION_LAYER,
  INITIAL_HOME_ACTOR_LAYER,
] as const
