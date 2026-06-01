// 该文件用于把正式像素主世界视图模型转换为渲染命令计划。

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

export function buildPixelWorldRenderPlan(model: PixelWorldViewModel): PixelWorldRenderPlan {
  const commands = sortRenderCommands([
    ...model.tiles.map((tile) => mapTileCommand(tile, model.canvas.tileSize)),
    ...model.traces.map(mapTraceCommand),
    ...model.objects.map(mapObjectCommand),
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

function mapTileCommand(tile: PixelWorldTile, tileSize: number): PixelWorldRenderCommand {
  return {
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
  };
}

function mapTraceCommand(trace: PixelWorldTrace): PixelWorldRenderCommand {
  return {
    id: `render_trace_${trace.id}`,
    layer: "trace",
    kind: "draw_trace_patch",
    sourceId: trace.id,
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
