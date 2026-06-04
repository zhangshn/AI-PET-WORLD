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
    ...model.traces.map(mapTraceCommand),
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

  const detailCount = tile.kind === "empty" ? 0 : 2 + (seed % 3);
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

function mapTraceCommand(trace: PixelWorldTrace): PixelWorldRenderCommand {
  return {
    id: `render_trace_${trace.id}`,
    layer: "trace",
    kind: "draw_trace_patch",
    sourceId: trace.sourceId ?? trace.id,
    bounds: trace.bounds,
    sortY: trace.bounds.y + trace.bounds.height,
    opacity: trace.opacity,
    visible: trace.opacity > 0,
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

function stableTileSeed(tile: PixelWorldTile): number {
  return Math.abs(tile.tileX * 73856093 + tile.tileY * 19349663 + tile.variant.length * 83492791);
}

function resolveTileBaseColor(tile: PixelWorldTile): string {
  if (tile.kind === "soil") return "#766a47";
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
  if (tile.kind === "worn_grass" || tile.kind === "pressed_grass") {
    return seed % 2 === 0 ? "#7f905f" : "#556f49";
  }

  return seed % 2 === 0 ? "#78aa6f" : "#4f7c4d";
}

function resolveTileShadowColor(tile: PixelWorldTile): string {
  if (tile.kind === "soil") return "#5f5439";
  if (tile.moisture && tile.moisture > 68) return "#4d765b";

  return "#4f744b";
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
