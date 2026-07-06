import type { HomeMapStructure } from "./home-map-structure-schema"
import { buildGameMapFrameFromHomeMapStructure } from "./game-map-frame-builder"

const sourceFactIds = [
  "fact-natural-home-grass-main",
  "fact-natural-home-water-east",
  "fact-natural-home-shoreline-east",
  "fact-natural-home-entry-path",
  "fact-natural-home-tree-boundary",
  "fact-natural-home-rocks",
  "fact-natural-home-soft-growth",
]

export const naturalHomeMvpHomeMapStructure: HomeMapStructure = {
  schemaVersion: "home-map-structure-v1",
  structureId: "home-map-structure-natural-home-mvp-001",
  worldId: "sample-natural-home-world",
  ownerId: "sample-owner",
  tick: 0,
  seed: "natural-home-mvp-seed-001",
  size: {
    width: 1024,
    height: 768,
    tileSize: 16,
  },
  entryPoint: { x: 96, y: 704 },
  homeCenter: { x: 512, y: 408 },
  terrainRegions: [
    {
      id: "terrain-grass-main",
      kind: "grass",
      polygon: [
        { x: 0, y: 0 },
        { x: 1024, y: 0 },
        { x: 1024, y: 768 },
        { x: 0, y: 768 },
      ],
      sourceFactIds: ["fact-natural-home-grass-main"],
    },
    {
      id: "terrain-water-east",
      kind: "water",
      polygon: [
        { x: 830, y: 0 },
        { x: 1024, y: 0 },
        { x: 1024, y: 768 },
        { x: 884, y: 768 },
        { x: 812, y: 430 },
      ],
      sourceFactIds: ["fact-natural-home-water-east"],
    },
    {
      id: "terrain-shoreline-east",
      kind: "shoreline",
      polygon: [
        { x: 792, y: 0 },
        { x: 852, y: 0 },
        { x: 844, y: 768 },
        { x: 792, y: 768 },
        { x: 772, y: 430 },
      ],
      sourceFactIds: ["fact-natural-home-shoreline-east"],
    },
    {
      id: "terrain-natural-boundary-west",
      kind: "natural_boundary",
      polygon: [
        { x: 0, y: 0 },
        { x: 128, y: 0 },
        { x: 128, y: 768 },
        { x: 0, y: 768 },
      ],
      sourceFactIds: ["fact-natural-home-tree-boundary"],
    },
  ],
  paths: [
    {
      id: "path-entry-to-home",
      kind: "entry_path",
      points: [
        { x: 96, y: 704 },
        { x: 230, y: 588 },
        { x: 340, y: 520 },
        { x: 512, y: 408 },
      ],
      width: 42,
      connects: ["entry_point", "home_center"],
      sourceFactIds: ["fact-natural-home-entry-path"],
    },
  ],
  objects: [
    {
      id: "tree-west-boundary-1",
      kind: "tree",
      position: { x: 92, y: 162 },
      footprint: { x: 58, y: 112, width: 92, height: 118 },
      blocksMovement: true,
      interactionKind: "inspect",
      sourceFactIds: ["fact-natural-home-tree-boundary"],
    },
    {
      id: "tree-south-boundary-1",
      kind: "tree",
      position: { x: 42, y: 636 },
      footprint: { x: 0, y: 574, width: 76, height: 128 },
      blocksMovement: true,
      interactionKind: "inspect",
      sourceFactIds: ["fact-natural-home-tree-boundary"],
    },
    {
      id: "rock-north-open-1",
      kind: "rock",
      position: { x: 432, y: 128 },
      footprint: { x: 398, y: 108, width: 76, height: 52 },
      blocksMovement: true,
      interactionKind: "inspect",
      sourceFactIds: ["fact-natural-home-rocks"],
    },
    {
      id: "rock-shoreline-1",
      kind: "rock",
      position: { x: 776, y: 520 },
      footprint: { x: 744, y: 494, width: 72, height: 54 },
      blocksMovement: true,
      interactionKind: "inspect",
      sourceFactIds: ["fact-natural-home-rocks"],
    },
    {
      id: "shrub-center-1",
      kind: "shrub",
      position: { x: 596, y: 332 },
      footprint: { x: 574, y: 312, width: 44, height: 36 },
      blocksMovement: false,
      interactionKind: "none",
      sourceFactIds: ["fact-natural-home-soft-growth"],
    },
    {
      id: "flower-patch-south-1",
      kind: "flower_patch",
      position: { x: 454, y: 636 },
      footprint: { x: 420, y: 610, width: 74, height: 42 },
      blocksMovement: false,
      interactionKind: "none",
      sourceFactIds: ["fact-natural-home-soft-growth"],
    },
  ],
  sourceFactIds,
  generationPolicy: {
    scope: "natural_home_mvp",
    allowAiPainterVisualFill: true,
    forbiddenFacts: [
      "character",
      "animal",
      "town",
      "city",
      "interior",
      "building_construction",
    ],
  },
  tags: [
    "natural_home_mvp",
    "structure_first",
    "no_character",
    "no_animal",
    "no_building_construction",
  ],
}

export const naturalHomeMvpGameMapFrame = buildGameMapFrameFromHomeMapStructure(
  naturalHomeMvpHomeMapStructure
)
