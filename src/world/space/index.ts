export type {
  SpaceBounds,
  SpaceCell,
  SpaceCoordinate,
  SpaceGrid,
  SpaceGridSummary,
  SpaceOccupancyKind,
  SpacePassability,
  SpaceRegion,
  SpaceRegionKind,
  SpaceTerrainKind,
  SpaceTraceStrength,
} from "./space-schema"
export {
  buildSpaceGridFromHomeMapState,
  type BuildSpaceGridFromHomeMapStateInput,
} from "./space-grid-builder"
export { summarizeSpaceGrid } from "./space-summary"
