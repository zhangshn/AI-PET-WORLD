import type { VisualGenerationPlan } from "@/world/visual-generation";

import type {
  PixelWorldActor,
  PixelWorldAtmosphere,
  PixelWorldLayerKind,
  PixelWorldObject,
  PixelWorldOverlay,
  PixelWorldTile,
  PixelWorldTrace,
  PixelWorldViewModel,
} from "./pixel-worldview-types";
import type {
  PixelWorldRenderCommand,
  PixelWorldRenderLayerSummary,
  PixelWorldRenderPlan,
} from "./pixel-worldview-render-types";

const LAYER_ORDER: PixelWorldLayerKind[] = ["tile", "trace", "object", "sprite", "atmosphere", "ui"];

export function buildPixelWorldRenderPlan(
  model: PixelWorldViewModel,
  input?: { visualGenerationPlan?: VisualGenerationPlan }
): PixelWorldRenderPlan {
  const visualObjectRecipeBySourceId = new Map(
    (input?.visualGenerationPlan?.objectRecipes ?? []).map((recipe) => [
      recipe.sourceObjectId,
      recipe,
    ])
  );
  const commands = sortRenderCommands([
    ...model.tiles.flatMap((tile) => mapTileCommands(tile, model.canvas.tileSize)),
    ...model.traces.flatMap((trace) => mapTraceCommands(trace, model.canvas.tileSize)),
    ...mapStorySceneCompositionCommands(model.traces, model.canvas),
    ...model.objects.flatMap((object) => {
      const visualRecipe = visualObjectRecipeBySourceId.get(object.id);

      return visualRecipe
        ? mapObjectBlockCommands(object, visualRecipe)
        : [mapObjectCommand(object)];
    }),
    ...model.actors.map(mapActorCommand),
    ...model.atmosphere.map(mapAtmosphereCommand),
    ...model.overlays.map(mapOverlayCommand),
  ]);

  return {
    worldId: model.worldId,
    tick: model.tick,
    canvas: model.canvas,
    commands,
    layerSummaries: buildLayerSummaries(commands),
  };
}

function mapObjectBlockCommands(
  object: PixelWorldObject,
  recipe: VisualGenerationPlan["objectRecipes"][number]
): PixelWorldRenderCommand[] {
  return recipe.blocks.map((block, index) => ({
    id: `render_object_block_${object.id}_${index}_${block.id}`,
    layer: "object",
    kind: "draw_object_block",
    sourceId: object.id,
    bounds: {
      x: block.x,
      y: block.y,
      width: block.width,
      height: block.height,
    },
    sortY: block.y + block.height,
    recipeId: recipe.recipeId,
    colorHint: block.color,
    opacity: block.opacity,
    visible: object.visible && block.opacity > 0,
    stateTags: [
      ...recipe.stateTags,
      ...block.stateTags,
      "visual_generation_block",
      "object_recipe_block",
    ],
  }));
}

function mapTileCommands(tile: PixelWorldTile, tileSize: number): PixelWorldRenderCommand[] {
  const seed = stableTileSeed(tile);
  const baseColor = resolveTileBaseColor(tile);
  const detailColor = resolveTileDetailColor(tile, seed);
  const shadowColor = resolveTileShadowColor(tile);
  const commands: PixelWorldRenderCommand[] = [{
    id: `render_tile_${tile.id}`,
    layer: "tile",
    kind: "fill_tile",
    sourceId: tile.id,
    bounds: {
      x: tile.x,
      y: tile.y,
      width: tileSize,
      height: tileSize,
    },
    tileX: tile.tileX,
    tileY: tile.tileY,
    visible: true,
    opacity: 1,
    colorHint: baseColor,
    stateTags: [
      "ground_base",
      `tile_kind:${tile.kind}`,
      tile.walkable ? "walkable" : "blocked",
    ],
  }];

  commands.push(...mapTileTransitionCommands({
    tile,
    tileSize,
    seed,
    detailColor,
    shadowColor,
  }));

  const detailCount = resolveTileDetailCount(tile, seed);
  for (let index = 0; index < detailCount; index += 1) {
    const chipSeed = seed + index * 37;
    const chipWidth = clampInt(Math.round(tileSize * (0.1 + (chipSeed % 3) * 0.035)), 3, 10);
    const chipHeight = clampInt(Math.round(tileSize * (0.035 + (chipSeed % 2) * 0.025)), 2, 6);
    const chipX = tile.x + clampInt((chipSeed * 7) % Math.max(1, tileSize - chipWidth), 1, tileSize - chipWidth);
    const chipY = tile.y + clampInt((chipSeed * 11) % Math.max(1, tileSize - chipHeight), 1, tileSize - chipHeight);

    commands.push({
      id: `render_tile_detail_${tile.id}_${index}`,
      layer: "tile",
      kind: "fill_tile",
      sourceId: tile.id,
      bounds: {
        x: chipX,
        y: chipY,
        width: chipWidth,
        height: chipHeight,
      },
      tileX: tile.tileX,
      tileY: tile.tileY,
      visible: true,
      opacity: 0.18 + (chipSeed % 4) * 0.04,
      colorHint: index % 2 === 0 ? detailColor : shadowColor,
      stateTags: [
        "ground_detail",
        "world_surface_texture",
        `tile_kind:${tile.kind}`,
      ],
    });
  }

  if ((tile.pressure ?? 0) > 35 || tile.kind === "pressed_grass" || tile.kind === "worn_grass") {
    commands.push({
      id: `render_tile_pressure_trace_${tile.id}`,
      layer: "tile",
      kind: "fill_tile",
      sourceId: tile.id,
      bounds: {
        x: tile.x + Math.round(tileSize * 0.16),
        y: tile.y + Math.round(tileSize * 0.58),
        width: Math.round(tileSize * 0.68),
        height: Math.max(3, Math.round(tileSize * 0.08)),
      },
      tileX: tile.tileX,
      tileY: tile.tileY,
      visible: true,
      opacity: 0.26,
      colorHint: "#6f7f52",
      stateTags: [
        "ground_pressure_trace",
        "worn_grass",
        "world_surface_texture",
      ],
    });
  }

  return commands;
}

function mapTileTransitionCommands(input: {
  tile: PixelWorldTile;
  tileSize: number;
  seed: number;
  detailColor: string;
  shadowColor: string;
}): PixelWorldRenderCommand[] {
  const { tile, tileSize, seed } = input;
  const commands: PixelWorldRenderCommand[] = [];

  if (tile.kind === "empty") return commands;

  if (
    (tile.kind === "ecology_transition" || tile.kind === "recovery_growth") &&
    shouldRenderTerrainTransitionBand(tile, seed)
  ) {
    const bandY = tile.y + clampInt((seed * 5) % Math.max(1, tileSize - 5), 2, tileSize - 5);
    commands.push({
      id: `render_tile_ecology_band_${tile.id}`,
      layer: "tile",
      kind: "fill_tile",
      sourceId: tile.id,
      bounds: {
        x: tile.x + Math.round(tileSize * 0.1),
        y: bandY,
        width: Math.round(tileSize * 0.76),
        height: Math.max(3, Math.round(tileSize * 0.12)),
      },
      tileX: tile.tileX,
      tileY: tile.tileY,
      visible: true,
      opacity: tile.kind === "recovery_growth" ? 0.32 : 0.24,
      colorHint: tile.kind === "recovery_growth" ? "#7fb06b" : input.detailColor,
      stateTags: [
        "ground_detail",
        "ecology_transition",
        "terrain_transition",
        `tile_kind:${tile.kind}`,
      ],
    });
  }

  if (tile.kind === "soil" || tile.kind === "worn_grass" || tile.kind === "pressed_grass") {
    commands.push({
      id: `render_tile_edge_shadow_${tile.id}`,
      layer: "tile",
      kind: "fill_tile",
      sourceId: tile.id,
      bounds: {
        x: tile.x,
        y: tile.y + Math.round(tileSize * 0.78),
        width: tileSize,
        height: Math.max(2, Math.round(tileSize * 0.08)),
      },
      tileX: tile.tileX,
      tileY: tile.tileY,
      visible: true,
      opacity: 0.12,
      colorHint: input.shadowColor,
      stateTags: [
        "ground_detail",
        "terrain_contact_shadow",
        `tile_kind:${tile.kind}`,
      ],
    });
  }

  return commands;
}

function resolveTileDetailCount(tile: PixelWorldTile, seed: number): number {
  if (tile.kind === "empty") return 0;
  if (tile.kind === "built") return 1;
  if (tile.kind === "soil") return 1 + (seed % 2);
  if (tile.kind === "worn_grass" || tile.kind === "pressed_grass") return 1 + (seed % 2);
  if (tile.kind === "ecology_transition" || tile.kind === "recovery_growth") {
    return seed % 4 === 0 ? 2 : 1;
  }

  return seed % 3 === 0 ? 2 : 1;
}

function shouldRenderTerrainTransitionBand(tile: PixelWorldTile, seed: number): boolean {
  if (tile.kind === "recovery_growth") return seed % 5 === 0;
  if (tile.kind === "ecology_transition") return seed % 3 === 0;

  return false;
}

function mapTraceCommands(trace: PixelWorldTrace, tileSize: number): PixelWorldRenderCommand[] {
  const role = storyTraceRole(trace);
  const baseColor = resolveTraceBaseColor(trace, role);
  const commands: PixelWorldRenderCommand[] = [{
    id: `render_trace_${trace.id}`,
    layer: "trace",
    kind: "draw_trace_patch",
    sourceId: trace.sourceId ?? trace.id,
    bounds: trace.bounds,
    sortY: trace.bounds.y + trace.bounds.height,
    opacity: trace.opacity,
    visible: trace.opacity > 0,
    colorHint: baseColor,
    stateTags: trace.stateTags,
  }];

  if (!isStoryTrace(trace)) return commands;

  commands.unshift({
    id: `render_trace_story_contact_${trace.id}`,
    layer: "trace",
    kind: "draw_trace_patch",
    sourceId: trace.sourceId ?? trace.id,
    bounds: {
      x: trace.bounds.x - Math.round(tileSize * 0.18),
      y: trace.bounds.y + Math.round(trace.bounds.height * 0.62),
      width: trace.bounds.width + Math.round(tileSize * 0.36),
      height: Math.max(4, Math.round(trace.bounds.height * 0.42)),
    },
    sortY: trace.bounds.y + trace.bounds.height - 1,
    opacity: Math.min(0.34, trace.opacity * 0.52),
    colorHint: "#3f563d",
    visible: trace.opacity > 0,
    stateTags: [
      ...(trace.stateTags ?? []),
      "story_trace_contact_shadow",
      "world_visual_depth_cue",
    ],
  });

  if (role === "foundation_pad" || role === "worked_ground") {
    commands.push(...mapStoryGroundDetailCommands({ trace, tileSize, role }));
  }

  if (role === "access_path" || role === "anchor_network_path") {
    commands.push(...mapStoryPathDetailCommands({ trace, tileSize, role }));
  }

  return commands;
}

function mapStoryGroundDetailCommands(input: {
  trace: PixelWorldTrace;
  tileSize: number;
  role: string | null;
}): PixelWorldRenderCommand[] {
  const { trace, tileSize } = input;
  const seed = stableHash(`${trace.id}:story-ground`);
  const detailCount = input.role === "foundation_pad" ? 5 : 3;

  return Array.from({ length: detailCount }, (_, index) => {
    const chipSeed = seed + index * 41;
    const width = clampInt(
      Math.round(tileSize * (0.72 + (chipSeed % 4) * 0.12)),
      10,
      Math.max(12, trace.bounds.width)
    );
    const height = clampInt(
      Math.round(tileSize * (0.16 + (chipSeed % 3) * 0.05)),
      3,
      Math.max(4, trace.bounds.height)
    );
    const x = trace.bounds.x + clampInt(
      (chipSeed * 7) % Math.max(1, trace.bounds.width - width),
      0,
      Math.max(0, trace.bounds.width - width)
    );
    const y = trace.bounds.y + clampInt(
      (chipSeed * 11) % Math.max(1, trace.bounds.height - height),
      0,
      Math.max(0, trace.bounds.height - height)
    );

    return {
      id: `render_trace_story_ground_detail_${trace.id}_${index}`,
      layer: "trace",
      kind: "draw_trace_patch",
      sourceId: trace.sourceId ?? trace.id,
      bounds: { x, y, width, height },
      sortY: y + height,
      opacity: Math.max(0.18, trace.opacity * 0.58),
      colorHint: index % 2 === 0 ? "#8a7650" : "#5f6f4a",
      visible: trace.opacity > 0,
      stateTags: [
        ...(trace.stateTags ?? []),
        "story_ground_detail",
        "worked_ground_readability",
      ],
    };
  });
}

function mapStoryPathDetailCommands(input: {
  trace: PixelWorldTrace;
  tileSize: number;
  role: string | null;
}): PixelWorldRenderCommand[] {
  const { trace, tileSize } = input;
  const width = Math.max(6, Math.round(trace.bounds.width * 0.54));
  const height = Math.max(3, Math.round(tileSize * 0.14));
  const left = trace.bounds.x + Math.round((trace.bounds.width - width) / 2);
  const top = trace.bounds.y + Math.round(trace.bounds.height * 0.36);

  return [
    {
      id: `render_trace_story_path_core_${trace.id}`,
      layer: "trace",
      kind: "draw_trace_patch",
      sourceId: trace.sourceId ?? trace.id,
      bounds: {
        x: left,
        y: top,
        width,
        height,
      },
      sortY: top + height,
      opacity: Math.max(0.18, trace.opacity * 0.74),
      colorHint: input.role === "anchor_network_path" ? "#7f7652" : "#8a7a51",
      visible: trace.opacity > 0,
      stateTags: [
        ...(trace.stateTags ?? []),
        "story_path_core",
        "access_path_readability",
      ],
    },
    {
      id: `render_trace_story_path_edge_${trace.id}`,
      layer: "trace",
      kind: "draw_trace_patch",
      sourceId: trace.sourceId ?? trace.id,
      bounds: {
        x: trace.bounds.x + Math.round(tileSize * 0.08),
        y: trace.bounds.y + Math.round(trace.bounds.height * 0.68),
        width: Math.max(5, Math.round(trace.bounds.width * 0.42)),
        height: Math.max(2, Math.round(tileSize * 0.1)),
      },
      sortY: trace.bounds.y + trace.bounds.height,
      opacity: Math.max(0.12, trace.opacity * 0.48),
      colorHint: "#536c48",
      visible: trace.opacity > 0,
      stateTags: [
        ...(trace.stateTags ?? []),
        "story_path_edge",
        "terrain_transition",
      ],
    },
  ];
}

function mapStorySceneCompositionCommands(
  traces: PixelWorldTrace[],
  canvas: PixelWorldViewModel["canvas"]
): PixelWorldRenderCommand[] {
  const storyTraces = traces.filter(isStoryTrace);
  const activeTraces = storyTraces.filter((trace) => {
    const role = storyTraceRole(trace);

    return role === "foundation_pad" || role === "worked_ground" || role === "access_path";
  });

  if (activeTraces.length === 0) return [];

  const sourceId = activeTraces[0].sourceId ?? activeTraces[0].id;
  const bounds = boundsForTraces(activeTraces);
  const center = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
  const tile = canvas.tileSize;
  const commands: PixelWorldRenderCommand[] = [
    ...mapStoryTerrainDepthCommands({
      sourceId,
      center,
      tileSize: tile,
      canvas,
    }),
    ...mapStoryWorkYardCommands({
      sourceId,
      center,
      tileSize: tile,
      canvas,
    }),
    ...mapStoryFoundationAssemblyCommands({
      sourceId,
      center,
      tileSize: tile,
      canvas,
    }),
    ...mapStoryMaterialClusterCommands({
      sourceId,
      center,
      tileSize: tile,
      canvas,
    }),
    ...mapStoryForegroundGuideCommands({
      sourceId,
      center,
      tileSize: tile,
      canvas,
    }),
    ...mapStoryNaturalFrameCommands({
      sourceId,
      center,
      tileSize: tile,
      canvas,
    }),
  ];

  return commands;
}

function mapStoryTerrainDepthCommands(input: {
  sourceId: string;
  center: { x: number; y: number };
  tileSize: number;
  canvas: PixelWorldViewModel["canvas"];
}): PixelWorldRenderCommand[] {
  const { sourceId, center, tileSize, canvas } = input;
  const terrainPatches = [
    { id: "upper_light_grass_0", x: -9.2, y: -6.2, w: 7.4, h: 1.9, color: "#78aa6f", opacity: 0.26 },
    { id: "upper_dark_grass_0", x: 2.1, y: -5.9, w: 6.8, h: 1.7, color: "#4f7c4d", opacity: 0.24 },
    { id: "upper_mid_light_grass_0", x: -1.6, y: -4.2, w: 5.8, h: 1.5, color: "#83b76d", opacity: 0.22 },
    { id: "middle_light_grass_0", x: -7.6, y: -2.1, w: 5.4, h: 1.4, color: "#83b76d", opacity: 0.26 },
    { id: "middle_dark_grass_0", x: 3.9, y: -1.9, w: 5.2, h: 1.3, color: "#4f744b", opacity: 0.24 },
    { id: "middle_soil_blend_0", x: -2.8, y: 0.7, w: 5.0, h: 1.2, color: "#806747", opacity: 0.2 },
    { id: "lower_soil_blend_0", x: -5.0, y: 2.8, w: 4.8, h: 1.2, color: "#806747", opacity: 0.24 },
    { id: "lower_light_grass_0", x: 2.8, y: 3.2, w: 4.6, h: 1.0, color: "#78aa6f", opacity: 0.22 },
    { id: "left_edge_depth_0", x: -10.5, y: -0.6, w: 2.6, h: 5.8, color: "#2f6f3a", opacity: 0.22 },
    { id: "right_edge_depth_0", x: 7.2, y: -1.2, w: 2.4, h: 5.2, color: "#3f6f3d", opacity: 0.22 },
  ];
  const chips = terrainPatches.flatMap((patch, patchIndex) =>
    Array.from({ length: 5 }, (_, chipIndex) => {
      const seed = stableHash(`${sourceId}:${patch.id}:${chipIndex}`);
      const width = Math.max(12, Math.round(tileSize * patch.w * (0.48 + (seed % 3) * 0.12)));
      const height = Math.max(4, Math.round(tileSize * patch.h * (0.42 + (seed % 2) * 0.16)));
      const x = clampInt(
        Math.round(center.x + tileSize * patch.x + (seed % Math.max(1, Math.round(tileSize * 1.4))) - width / 2),
        0,
        Math.max(0, canvas.width - width)
      );
      const y = clampInt(
        Math.round(center.y + tileSize * patch.y + ((seed >> 3) % Math.max(1, Math.round(tileSize * 0.8))) - height / 2),
        0,
        Math.max(0, canvas.height - height)
      );

      return storyCompositionCommand({
        id: `render_story_scene_${sourceId}_terrain_depth_${patchIndex}_${chipIndex}`,
        sourceId,
        bounds: { x, y, width, height },
        opacity: patch.opacity,
        colorHint: patch.color,
        sortY: y + height,
        tags: [
          "story_terrain_depth",
          "terrain_depth_variation",
          "world_surface_texture",
        ],
      });
    })
  );

  return chips;
}

function mapStoryWorkYardCommands(input: {
  sourceId: string;
  center: { x: number; y: number };
  tileSize: number;
  canvas: PixelWorldViewModel["canvas"];
}): PixelWorldRenderCommand[] {
  const { sourceId, center, tileSize, canvas } = input;
  const yardWidth = Math.round(tileSize * 12.5);
  const yardHeight = Math.round(tileSize * 5.8);
  const yardLeft = center.x - yardWidth * 0.5;
  const yardTop = center.y - tileSize * 0.9;
  const patches = [
    { id: "yard_floor_left", x: -0.5, y: 0.0, w: 0.54, h: 0.5, color: "#6f7651", opacity: 0.3 },
    { id: "yard_floor_mid", x: -0.12, y: -0.04, w: 0.62, h: 0.58, color: "#786d4e", opacity: 0.36 },
    { id: "yard_floor_right", x: 0.28, y: 0.08, w: 0.48, h: 0.46, color: "#5f704d", opacity: 0.28 },
    { id: "yard_lower_shadow", x: -0.22, y: 0.48, w: 0.78, h: 0.2, color: "#40543d", opacity: 0.26 },
    { id: "yard_upper_edge", x: -0.06, y: -0.24, w: 0.62, h: 0.16, color: "#8a7650", opacity: 0.3 },
    { id: "yard_left_edge", x: -0.58, y: 0.24, w: 0.18, h: 0.4, color: "#806747", opacity: 0.22 },
    { id: "yard_right_edge", x: 0.58, y: 0.26, w: 0.18, h: 0.34, color: "#806747", opacity: 0.22 },
  ];

  return patches.map((patch) => {
    const width = Math.max(8, Math.round(yardWidth * patch.w));
    const height = Math.max(4, Math.round(yardHeight * patch.h));
    const x = clampInt(Math.round(yardLeft + yardWidth * patch.x), 0, Math.max(0, canvas.width - width));
    const y = clampInt(Math.round(yardTop + yardHeight * patch.y), 0, Math.max(0, canvas.height - height));

    return storyCompositionCommand({
      id: `render_story_scene_${sourceId}_${patch.id}`,
      sourceId,
      bounds: { x, y, width, height },
      opacity: patch.opacity,
      colorHint: patch.color,
      sortY: y + height,
      tags: ["story_work_yard", "story_scene_composition"],
    });
  });
}

function mapStoryFoundationAssemblyCommands(input: {
  sourceId: string;
  center: { x: number; y: number };
  tileSize: number;
  canvas: PixelWorldViewModel["canvas"];
}): PixelWorldRenderCommand[] {
  const { sourceId, center, tileSize, canvas } = input;
  const cells = [
    { id: "foundation_shadow", x: -2.74, y: 1.04, w: 5.92, h: 0.54, color: "#304334", opacity: 0.34 },
    { id: "foundation_floor", x: -2.28, y: -0.44, w: 4.7, h: 1.72, color: "#7b5631", opacity: 0.82 },
    { id: "foundation_floor_light", x: -1.82, y: -0.18, w: 3.56, h: 0.38, color: "#9b7848", opacity: 0.58 },
    { id: "foundation_back_wall_dark", x: -2.38, y: -1.06, w: 4.94, h: 0.42, color: "#59635a", opacity: 0.92 },
    { id: "foundation_back_wall_light", x: -2.08, y: -1.38, w: 4.32, h: 0.36, color: "#a8b1a7", opacity: 0.82 },
    { id: "foundation_front_wall", x: -2.52, y: 0.96, w: 5.16, h: 0.46, color: "#59635a", opacity: 0.96 },
    { id: "foundation_front_wall_light", x: -2.22, y: 0.74, w: 4.3, h: 0.26, color: "#a8b1a7", opacity: 0.7 },
    { id: "foundation_left_wall", x: -2.68, y: -0.86, w: 0.42, h: 2.08, color: "#818b80", opacity: 0.94 },
    { id: "foundation_left_wall_dark", x: -2.86, y: -0.5, w: 0.26, h: 1.78, color: "#59635a", opacity: 0.84 },
    { id: "foundation_right_wall", x: 2.36, y: -0.84, w: 0.42, h: 2.02, color: "#818b80", opacity: 0.94 },
    { id: "foundation_right_wall_light", x: 2.18, y: -0.74, w: 0.24, h: 1.54, color: "#a8b1a7", opacity: 0.62 },
    { id: "entry_step_0", x: -0.54, y: 1.42, w: 1.04, h: 0.28, color: "#a08452", opacity: 0.76 },
    { id: "entry_step_1", x: -0.78, y: 1.72, w: 1.48, h: 0.28, color: "#7b5631", opacity: 0.82 },
    { id: "entry_step_2", x: -1.02, y: 2.02, w: 1.88, h: 0.24, color: "#93602f", opacity: 0.74 },
    { id: "scaffold_post_left", x: -3.06, y: -2.0, w: 0.24, h: 3.22, color: "#93602f", opacity: 0.92 },
    { id: "scaffold_post_mid_left", x: -1.36, y: -2.34, w: 0.22, h: 3.1, color: "#c28340", opacity: 0.86 },
    { id: "scaffold_post_mid_right", x: 1.26, y: -2.22, w: 0.22, h: 3.0, color: "#93602f", opacity: 0.9 },
    { id: "scaffold_post_right", x: 2.94, y: -1.92, w: 0.24, h: 3.0, color: "#5b351f", opacity: 0.9 },
    { id: "scaffold_top_beam", x: -3.2, y: -1.78, w: 6.34, h: 0.2, color: "#c28340", opacity: 0.82 },
    { id: "scaffold_mid_beam", x: -3.0, y: -0.78, w: 5.9, h: 0.2, color: "#93602f", opacity: 0.84 },
    { id: "scaffold_front_beam", x: -2.72, y: 0.34, w: 5.38, h: 0.2, color: "#c28340", opacity: 0.74 },
    { id: "stone_pile_right_shadow", x: 3.24, y: 1.18, w: 1.9, h: 0.28, color: "#304334", opacity: 0.28 },
    { id: "stone_pile_right_base", x: 3.36, y: 0.78, w: 1.56, h: 0.46, color: "#59635a", opacity: 0.84 },
    { id: "stone_pile_right_top", x: 3.58, y: 0.48, w: 1.06, h: 0.28, color: "#a8b1a7", opacity: 0.68 },
    { id: "wood_stack_right_shadow", x: 1.92, y: 1.9, w: 2.34, h: 0.28, color: "#304334", opacity: 0.26 },
    { id: "wood_stack_right_a", x: 1.96, y: 1.54, w: 2.2, h: 0.22, color: "#93602f", opacity: 0.9 },
    { id: "wood_stack_right_b", x: 2.14, y: 1.78, w: 1.96, h: 0.2, color: "#c28340", opacity: 0.72 },
    { id: "lumber_left_base", x: -4.18, y: 0.62, w: 1.44, h: 0.38, color: "#93602f", opacity: 0.78 },
    { id: "lumber_left_light", x: -4.0, y: 0.38, w: 1.0, h: 0.18, color: "#c28340", opacity: 0.58 },
  ];

  return cells.map((cell) => {
    const width = Math.max(3, Math.round(tileSize * cell.w));
    const height = Math.max(3, Math.round(tileSize * cell.h));
    const x = clampInt(Math.round(center.x + tileSize * cell.x), 0, Math.max(0, canvas.width - width));
    const y = clampInt(Math.round(center.y + tileSize * cell.y), 0, Math.max(0, canvas.height - height));

    return storyObjectBlockCommand({
      id: `render_story_scene_${sourceId}_${cell.id}`,
      sourceId,
      bounds: { x, y, width, height },
      opacity: cell.opacity,
      colorHint: cell.color,
      sortY: y + height,
      tags: [
        "story_foundation_assembly",
        "story_material_cluster",
        "construction_material_readability",
      ],
    });
  });
}

function mapStoryMaterialClusterCommands(input: {
  sourceId: string;
  center: { x: number; y: number };
  tileSize: number;
  canvas: PixelWorldViewModel["canvas"];
}): PixelWorldRenderCommand[] {
  const { sourceId, center, tileSize, canvas } = input;
  const materialCells = [
    { id: "stone_stack_shadow", x: -4.6, y: 1.15, w: 2.55, h: 0.46, color: "#3f563d", opacity: 0.3 },
    { id: "stone_stack_base", x: -4.45, y: 0.84, w: 2.05, h: 0.62, color: "#59635a", opacity: 0.82 },
    { id: "stone_stack_mid", x: -4.16, y: 0.56, w: 1.35, h: 0.42, color: "#818b80", opacity: 0.78 },
    { id: "stone_stack_light", x: -3.95, y: 0.38, w: 0.96, h: 0.24, color: "#a8b1a7", opacity: 0.66 },
    { id: "crate_shadow", x: -5.15, y: 1.82, w: 1.45, h: 0.34, color: "#3f563d", opacity: 0.24 },
    { id: "crate_base", x: -5.0, y: 1.32, w: 1.08, h: 0.58, color: "#93602f", opacity: 0.72 },
    { id: "crate_highlight", x: -4.82, y: 1.18, w: 0.76, h: 0.16, color: "#c28340", opacity: 0.56 },
    { id: "wood_stack_shadow", x: 2.55, y: 1.2, w: 3.05, h: 0.42, color: "#3f563d", opacity: 0.28 },
    { id: "wood_stack_1", x: 2.62, y: 0.78, w: 2.65, h: 0.26, color: "#93602f", opacity: 0.82 },
    { id: "wood_stack_2", x: 2.82, y: 1.02, w: 2.38, h: 0.24, color: "#c28340", opacity: 0.68 },
    { id: "wood_stack_3", x: 2.48, y: 1.26, w: 1.86, h: 0.18, color: "#5b351f", opacity: 0.74 },
    { id: "barrel_shadow", x: 1.36, y: 1.55, w: 0.86, h: 0.26, color: "#3f563d", opacity: 0.22 },
    { id: "barrel_body", x: 1.44, y: 1.03, w: 0.54, h: 0.68, color: "#93602f", opacity: 0.72 },
    { id: "barrel_light", x: 1.56, y: 0.94, w: 0.34, h: 0.16, color: "#c28340", opacity: 0.5 },
    { id: "tool_glint", x: 1.98, y: 0.46, w: 0.28, h: 0.28, color: "#d6efb5", opacity: 0.68 },
  ];

  return materialCells.map((cell) => {
    const width = Math.max(3, Math.round(tileSize * cell.w));
    const height = Math.max(3, Math.round(tileSize * cell.h));
    const x = clampInt(Math.round(center.x + tileSize * cell.x), 0, Math.max(0, canvas.width - width));
    const y = clampInt(Math.round(center.y + tileSize * cell.y), 0, Math.max(0, canvas.height - height));

    return storyObjectBlockCommand({
      id: `render_story_scene_${sourceId}_${cell.id}`,
      sourceId,
      bounds: { x, y, width, height },
      opacity: cell.opacity,
      colorHint: cell.color,
      sortY: y + height,
      tags: ["story_material_cluster", "construction_material_readability"],
    });
  });
}

function mapStoryForegroundGuideCommands(input: {
  sourceId: string;
  center: { x: number; y: number };
  tileSize: number;
  canvas: PixelWorldViewModel["canvas"];
}): PixelWorldRenderCommand[] {
  const { sourceId, center, tileSize, canvas } = input;
  const lowerTarget = {
    x: clampInt(Math.round(canvas.width * 0.5), tileSize, canvas.width - tileSize),
    y: clampInt(Math.round(canvas.height * 0.88), tileSize, canvas.height - tileSize),
  };
  const segmentCount = 12;

  return Array.from({ length: segmentCount }, (_, index) => {
    const progress = (index + 1) / (segmentCount + 1);
    const curve = Math.sin(progress * Math.PI) * tileSize * 1.7;
    const width = Math.round(tileSize * (2.9 - index * 0.07));
    const height = Math.max(10, Math.round(tileSize * 0.42));
    const x = clampInt(
      Math.round(lerp(center.x - tileSize * 0.3, lowerTarget.x, progress) + curve - width / 2),
      0,
      Math.max(0, canvas.width - width)
    );
    const y = clampInt(
      Math.round(lerp(center.y + tileSize * 1.3, lowerTarget.y, progress) - height / 2),
      0,
      Math.max(0, canvas.height - height)
    );

    return storyCompositionCommand({
      id: `render_story_scene_${sourceId}_foreground_path_${index}`,
      sourceId,
      bounds: { x, y, width, height },
      opacity: 0.24,
      colorHint: index % 2 === 0 ? "#8a7650" : "#7a744f",
      sortY: y + height,
      tags: ["story_foreground_path", "foreground_composition_projection"],
    });
  });
}

function mapStoryNaturalFrameCommands(input: {
  sourceId: string;
  center: { x: number; y: number };
  tileSize: number;
  canvas: PixelWorldViewModel["canvas"];
}): PixelWorldRenderCommand[] {
  const { sourceId, center, tileSize, canvas } = input;
  const frameCells = [
    { id: "left_tree_mass_shadow", x: -10.2, y: 1.05, w: 2.95, h: 3.0, color: "#0d4026", opacity: 0.5 },
    { id: "left_tree_mass_leaf", x: -9.9, y: 0.72, w: 2.38, h: 1.72, color: "#2f7a3d", opacity: 0.62 },
    { id: "left_tree_mass_light", x: -9.65, y: 0.42, w: 1.38, h: 0.58, color: "#78c65a", opacity: 0.42 },
    { id: "left_lower_bush_mass", x: -8.6, y: 3.52, w: 2.4, h: 0.72, color: "#2f6f3a", opacity: 0.56 },
    { id: "left_lower_bush_light", x: -8.18, y: 3.32, w: 1.32, h: 0.32, color: "#78aa6f", opacity: 0.38 },
    { id: "right_bush_mass_shadow", x: 6.55, y: 1.1, w: 3.05, h: 1.48, color: "#0d4026", opacity: 0.44 },
    { id: "right_bush_mass_leaf", x: 6.85, y: 0.82, w: 2.38, h: 0.98, color: "#2f7a3d", opacity: 0.58 },
    { id: "right_bush_mass_light", x: 7.2, y: 0.58, w: 1.14, h: 0.32, color: "#78c65a", opacity: 0.34 },
    { id: "right_stone_cluster_shadow", x: 6.1, y: 3.42, w: 1.9, h: 0.34, color: "#3f563d", opacity: 0.26 },
    { id: "right_stone_cluster_base", x: 6.22, y: 3.12, w: 1.42, h: 0.44, color: "#818b80", opacity: 0.58 },
    { id: "right_stone_cluster_light", x: 6.44, y: 2.92, w: 0.82, h: 0.24, color: "#a8b1a7", opacity: 0.42 },
    { id: "foreground_grass_mass_left", x: -4.6, y: 4.72, w: 2.65, h: 0.72, color: "#2f6f3a", opacity: 0.5 },
    { id: "foreground_grass_mass_mid", x: -0.8, y: 4.82, w: 2.1, h: 0.58, color: "#4f7c4d", opacity: 0.42 },
    { id: "foreground_grass_mass_right", x: 3.2, y: 4.55, w: 2.78, h: 0.74, color: "#2f6f3a", opacity: 0.5 },
    { id: "foreground_flower_a", x: -2.65, y: 4.15, w: 0.24, h: 0.24, color: "#d8a0b4", opacity: 0.74 },
    { id: "foreground_flower_b", x: 2.95, y: 3.85, w: 0.22, h: 0.22, color: "#d8a0b4", opacity: 0.7 },
    { id: "foreground_stone_a", x: -0.95, y: 4.34, w: 0.72, h: 0.28, color: "#818b80", opacity: 0.5 },
    { id: "upper_edge_grass_mass", x: -3.8, y: -5.7, w: 5.4, h: 0.72, color: "#2f6f3a", opacity: 0.24 },
    { id: "upper_edge_grass_light", x: -2.7, y: -5.96, w: 2.8, h: 0.32, color: "#78aa6f", opacity: 0.24 },
  ];

  return frameCells.map((cell) => {
    const width = Math.max(3, Math.round(tileSize * cell.w));
    const height = Math.max(3, Math.round(tileSize * cell.h));
    const x = clampInt(Math.round(center.x + tileSize * cell.x), 0, Math.max(0, canvas.width - width));
    const y = clampInt(Math.round(center.y + tileSize * cell.y), 0, Math.max(0, canvas.height - height));

    return storyCompositionCommand({
      id: `render_story_scene_${sourceId}_${cell.id}`,
      sourceId,
      bounds: { x, y, width, height },
      opacity: cell.opacity,
      colorHint: cell.color,
      sortY: y + height,
      tags: ["story_natural_frame", "foreground_composition_projection"],
    });
  });
}

function storyCompositionCommand(input: {
  id: string;
  sourceId: string;
  bounds: { x: number; y: number; width: number; height: number };
  opacity: number;
  colorHint: string;
  sortY: number;
  tags: string[];
}): PixelWorldRenderCommand {
  return {
    id: input.id,
    layer: "trace",
    kind: "draw_trace_patch",
    sourceId: input.sourceId,
    bounds: input.bounds,
    sortY: input.sortY,
    opacity: input.opacity,
    visible: input.opacity > 0,
    colorHint: input.colorHint,
    stateTags: [
      "visual_only",
      "fact_backed_visual_projection",
      "read_only_projection",
      "no_runtime_write",
      "story_scene_composition",
      ...input.tags,
    ],
  };
}

function storyObjectBlockCommand(input: {
  id: string;
  sourceId: string;
  bounds: { x: number; y: number; width: number; height: number };
  opacity: number;
  colorHint: string;
  sortY: number;
  tags: string[];
}): PixelWorldRenderCommand {
  return {
    id: input.id,
    layer: "object",
    kind: "draw_object_block",
    sourceId: input.sourceId,
    bounds: input.bounds,
    sortY: input.sortY,
    opacity: input.opacity,
    visible: input.opacity > 0,
    colorHint: input.colorHint,
    stateTags: [
      "visual_only",
      "fact_backed_visual_projection",
      "read_only_projection",
      "no_runtime_write",
      "story_scene_composition",
      "story_scene_object_block",
      ...input.tags,
    ],
  };
}

function mapObjectCommand(object: PixelWorldObject): PixelWorldRenderCommand {
  return {
    id: `render_object_${object.id}`,
    layer: "object",
    kind: "place_object_recipe",
    sourceId: object.id,
    bounds: object.bounds,
    sortY: object.sortY,
    recipeId: object.recipeId,
    visible: object.visible,
    stateTags: object.stateTags,
  };
}

function mapActorCommand(actor: PixelWorldActor): PixelWorldRenderCommand {
  return {
    id: `render_actor_${actor.id}`,
    layer: "sprite",
    kind: "draw_actor_marker",
    sourceId: actor.id,
    bounds: actor.bounds,
    sortY: actor.sortY,
    visible: actor.visible,
    stateTags: actor.stateTags,
  };
}

function mapAtmosphereCommand(atmosphere: PixelWorldAtmosphere): PixelWorldRenderCommand {
  return {
    id: `render_atmosphere_${atmosphere.id}`,
    layer: "atmosphere",
    kind: "apply_atmosphere_tint",
    sourceId: atmosphere.id,
    opacity: atmosphere.opacity,
    visible: atmosphere.opacity > 0,
  };
}

function mapOverlayCommand(overlay: PixelWorldOverlay): PixelWorldRenderCommand {
  return {
    id: `render_overlay_${overlay.id}`,
    layer: "ui",
    kind: "draw_overlay_label",
    sourceId: overlay.id,
    text: overlay.text,
    visible: overlay.visible,
    opacity: overlay.visible ? 1 : 0,
  };
}

function sortRenderCommands(commands: PixelWorldRenderCommand[]): PixelWorldRenderCommand[] {
  return commands
    .map((command, index) => ({ command, index }))
    .sort((left, right) => {
      const layerDifference = layerOrderOf(left.command.layer) - layerOrderOf(right.command.layer);
      if (layerDifference !== 0) return layerDifference;

      if (left.command.layer === "trace" || left.command.layer === "object" || left.command.layer === "sprite") {
        const sortDifference = (left.command.sortY ?? 0) - (right.command.sortY ?? 0);
        if (sortDifference !== 0) return sortDifference;
      }

      return left.index - right.index;
    })
    .map(({ command }) => command);
}

function buildLayerSummaries(commands: PixelWorldRenderCommand[]): PixelWorldRenderLayerSummary[] {
  return LAYER_ORDER.map((layer) => ({
    layer,
    count: commands.filter((command) => command.layer === layer).length,
  }));
}

function layerOrderOf(layer: PixelWorldLayerKind): number {
  return LAYER_ORDER.indexOf(layer);
}

function boundsForTraces(traces: PixelWorldTrace[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const left = Math.min(...traces.map((trace) => trace.bounds.x));
  const top = Math.min(...traces.map((trace) => trace.bounds.y));
  const right = Math.max(...traces.map((trace) => trace.bounds.x + trace.bounds.width));
  const bottom = Math.max(...traces.map((trace) => trace.bounds.y + trace.bounds.height));

  return {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function stableTileSeed(tile: PixelWorldTile): number {
  return Math.abs(tile.tileX * 73856093 + tile.tileY * 19349663 + tile.variant.length * 83492791);
}

function stableHash(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash >>> 0);
}

function resolveTileBaseColor(tile: PixelWorldTile): string {
  if (tile.kind === "soil") return "#766a47";
  if (tile.kind === "built") return "#6f6c58";
  if (tile.kind === "ecology_transition") return "#668d5d";
  if (tile.kind === "recovery_growth") return "#6f9f62";
  if (tile.kind === "worn_grass") return "#6e8454";
  if (tile.kind === "pressed_grass") return "#668052";
  if (tile.kind === "empty") return "#4f6a4f";

  const ecology = tile.ecologyHealth ?? 62;
  if (ecology > 76) return "#659760";
  if (ecology < 38) return "#6f7d55";

  return "#5f8f60";
}

function resolveTileDetailColor(tile: PixelWorldTile, seed: number): string {
  if (tile.kind === "soil") return seed % 2 === 0 ? "#8a7650" : "#5f563d";
  if (tile.kind === "built") return seed % 2 === 0 ? "#7f7960" : "#5c5848";
  if (tile.kind === "ecology_transition") return seed % 2 === 0 ? "#78a66b" : "#567a50";
  if (tile.kind === "recovery_growth") return seed % 2 === 0 ? "#83b76d" : "#5c8d52";
  if (tile.kind === "worn_grass" || tile.kind === "pressed_grass") {
    return seed % 2 === 0 ? "#7f905f" : "#556f49";
  }

  return seed % 2 === 0 ? "#78aa6f" : "#4f7c4d";
}

function resolveTileShadowColor(tile: PixelWorldTile): string {
  if (tile.kind === "built") return "#545143";
  if (tile.kind === "soil") return "#5f5439";
  if (tile.moisture && tile.moisture > 68) return "#4d765b";

  return "#4f744b";
}

function isStoryTrace(trace: PixelWorldTrace): boolean {
  return (trace.stateTags ?? []).includes("story_staging_trace");
}

function storyTraceRole(trace: PixelWorldTrace): string | null {
  return (
    (trace.stateTags ?? [])
      .find((tag) => tag.startsWith("story_trace_role:"))
      ?.slice("story_trace_role:".length) ?? null
  );
}

function resolveTraceBaseColor(trace: PixelWorldTrace, role: string | null): string {
  if (role === "foundation_pad") return "#796f50";
  if (role === "worked_ground") return "#6f7651";
  if (role === "staging_edge") return "#5d704d";
  if (role === "access_path") return "#7a744f";
  if (role === "anchor_network_path") return "#6f6f4d";
  if (trace.kind === "bare_soil") return "#806747";
  if (trace.kind === "maintenance") return "#747c52";
  if (trace.kind === "recovery") return "#5f8a55";
  if (trace.kind === "waiting_spot") return "#6f7a55";

  return "#66774d";
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
