// 该文件用于提供正式像素主世界视图模型的最小测试快照。

import { mapPixelWorldViewModelFromSnapshot } from "./pixel-worldview-mapper";
import type { PixelWorldViewModel } from "./pixel-worldview-types";
import type { PixelWorldSourceSnapshot } from "./pixel-worldview-source";

export function createMinimalPixelWorldSourceSnapshot(): PixelWorldSourceSnapshot {
  return {
    worldId: "mock_pixel_world",
    tick: 0,
    width: 640,
    height: 360,
    tileSize: 16,
    tiles: [
      { kind: "grass", tileX: 0, tileY: 0, variant: "mock_grass", walkable: true, movementCost: 1, moisture: 0.54 },
      { kind: "pressed_grass", tileX: 1, tileY: 0, variant: "mock_pressed", walkable: true, movementCost: 1, pressure: 0.48 },
      { kind: "grass", tileX: 2, tileY: 0, variant: "mock_grass", walkable: true, movementCost: 1, ecologyHealth: 0.82 },
      { kind: "soil", tileX: 0, tileY: 1, variant: "mock_soil", walkable: true, movementCost: 1.2, moisture: 0.36 },
      { kind: "grass", tileX: 1, tileY: 1, variant: "mock_grass", walkable: true, movementCost: 1, ecologyHealth: 0.76 },
      { kind: "worn_grass", tileX: 2, tileY: 1, variant: "mock_pressed", walkable: true, movementCost: 1, pressure: 0.62 },
      { kind: "grass", tileX: 0, tileY: 2, variant: "mock_grass", walkable: true, movementCost: 1 },
      { kind: "soil", tileX: 1, tileY: 2, variant: "mock_soil", walkable: true, movementCost: 1.2 },
      { kind: "grass", tileX: 2, tileY: 2, variant: "mock_grass", walkable: true, movementCost: 1, ecologyHealth: 0.88 },
    ],
    traces: [
      {
        kind: "pressed_grass",
        bounds: { x: 16, y: 0, width: 16, height: 16 },
        strength: 0.48,
        opacity: 0.34,
      },
      {
        kind: "footprint",
        bounds: { x: 24, y: 20, width: 8, height: 12 },
        strength: 0.62,
        opacity: 0.42,
        age: 2,
      },
    ],
    objects: [
      {
        kind: "tree",
        recipeId: "natural_tree_object_recipe",
        bounds: { x: 48, y: 48, width: 64, height: 96 },
        anchor: { x: 80, y: 144, type: "root_bottom" },
        visible: true,
        stateTags: ["mock", "natural"],
      },
      {
        kind: "grass_tile",
        recipeId: "natural_grass_tile_recipe",
        bounds: { x: 0, y: 0, width: 48, height: 48 },
        anchor: { x: 0, y: 0, type: "tile_origin" },
        visible: true,
        stateTags: ["mock", "natural"],
      },
      {
        kind: "stone",
        recipeId: "natural_stone_object_recipe",
        bounds: { x: 128, y: 112, width: 48, height: 32 },
        anchor: { x: 152, y: 144, type: "center_bottom" },
        visible: true,
        stateTags: ["mock", "natural"],
      },
      {
        kind: "insect",
        recipeId: "natural_insect_signal_recipe",
        bounds: { x: 176, y: 80, width: 24, height: 18 },
        anchor: { x: 188, y: 89, type: "body_center" },
        visible: true,
        stateTags: ["mock", "natural"],
      },
    ],
    actors: [
      {
        id: "actor_mock_butler",
        kind: "butler",
        bounds: { x: 96, y: 96, width: 24, height: 32 },
        anchor: { x: 108, y: 128, type: "center_bottom" },
        visible: true,
        stateTags: ["mock", "idle"],
      },
    ],
    atmosphere: [
      {
        id: "atmosphere_mock_time_light",
        layer: "atmosphere",
        kind: "time_light",
        opacity: 0.18,
        intensity: 0.45,
      },
    ],
  };
}

export function createMinimalPixelWorldViewModel(): PixelWorldViewModel {
  return mapPixelWorldViewModelFromSnapshot(createMinimalPixelWorldSourceSnapshot());
}
