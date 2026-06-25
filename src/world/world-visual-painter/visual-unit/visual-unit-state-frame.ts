import type { VisualUnitFrameSpec } from "./visual-unit-schema"

export const NATURAL_STATIC_FRAME: VisualUnitFrameSpec = {
  frameId: "natural-static-base",
  kind: "static",
  lifecycleState: "idle",
  actionState: "none",
  frameCount: 1,
  frameRate: 0,
  requiredConditionChannels: ["grass", "water_body", "shoreline", "road_center", "road_edge", "tree_trunk", "tree_crown", "rock", "walkable", "depth"],
}

export const NATURAL_LOOP_FRAME: VisualUnitFrameSpec = {
  frameId: "natural-subtle-loop",
  kind: "loop",
  lifecycleState: "idle",
  actionState: "loop",
  frameCount: 4,
  frameRate: 6,
  requiredConditionChannels: ["water_body", "shoreline", "tree_crown", "grass"],
}

export const CHARACTER_IDLE_FRAME: VisualUnitFrameSpec = {
  frameId: "character-idle-base",
  kind: "loop",
  lifecycleState: "idle",
  actionState: "idle",
  frameCount: 4,
  frameRate: 6,
  requiredConditionChannels: ["walkable", "depth"],
}

export const BUILDING_LIFECYCLE_FRAME: VisualUnitFrameSpec = {
  frameId: "building-lifecycle-stage",
  kind: "lifecycle",
  lifecycleState: "building",
  actionState: "build",
  frameCount: 4,
  frameRate: 0,
  requiredConditionChannels: ["shelter_foundation", "shelter_wall", "shelter_roof", "construction_material", "walkable", "depth"],
}
