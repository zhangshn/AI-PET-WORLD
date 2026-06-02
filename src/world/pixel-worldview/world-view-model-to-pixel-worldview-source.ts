// 该文件用于把正式世界视图模型转换成 PixelWorldView 输入快照。
import type { WorldViewModel, WorldViewObjectKind, WorldViewTileKind } from "@/world/world-view-model";
import type {
  PixelWorldActorKind,
  PixelWorldObjectKind,
  PixelWorldTileKind,
  PixelWorldTraceKind,
} from "./pixel-worldview-types";
import type { PixelWorldSourceSnapshot } from "./pixel-worldview-source";

export function mapWorldViewModelToPixelWorldSourceSnapshot(model: WorldViewModel): PixelWorldSourceSnapshot {
  return {
    worldId: model.worldId,
    tick: model.tick,
    width: model.canvas.width,
    height: model.canvas.height,
    tileSize: model.canvas.tileSize,
    tiles: model.tiles.map((tile) => ({
      id: tile.id,
      kind: mapTileKind(tile.kind),
      tileX: Math.floor(tile.x / model.canvas.tileSize),
      tileY: Math.floor(tile.y / model.canvas.tileSize),
      variant: `world_tile_${tile.variant}`,
      walkable: tile.passable,
      movementCost: tile.passable ? 1 : 99,
      pressure: tile.traceIntensity,
    })),
    traces: model.traces.map((trace) => ({
      id: trace.id,
      kind: mapTraceKind(trace.visualKind),
      bounds: {
        x: trace.x - trace.radius,
        y: trace.y - trace.radius,
        width: trace.radius * 2,
        height: trace.radius * 2,
      },
      strength: trace.intensity,
      opacity: trace.opacity,
    })),
    objects: model.objects.map((object) => {
      const kind = mapObjectKind(object.kind);
      const width = Math.max(16, Math.round(24 * object.scale));
      const height = Math.max(16, Math.round(32 * object.scale));

      return {
        id: object.id,
        kind,
        recipeId: recipeIdForObjectKind(kind),
        bounds: {
          x: object.x,
          y: object.y,
          width,
          height,
        },
        anchor: {
          x: object.x + width / 2,
          y: object.y + height,
          type: "center_bottom" as const,
        },
        sortY: object.y + height,
        visible: object.opacity > 0,
        stateTags: [...object.tags, object.growthStage, object.source],
      };
    }),
    actors: model.actors.map((actor) => ({
      id: actor.id,
      kind: mapActorKind(actor.kind),
      bounds: {
        x: actor.x,
        y: actor.y,
        width: 24,
        height: 32,
      },
      anchor: {
        x: actor.x + 12,
        y: actor.y + 32,
        type: "center_bottom",
      },
      sortY: actor.y + 32,
      visible: actor.visible,
      stateTags: [actor.pose, actor.layer, actor.label],
    })),
    atmosphere: [
      {
        id: "atmosphere_world_time_light",
        layer: "atmosphere",
        kind: "time_light",
        opacity: model.atmosphere.opacity,
        intensity: model.atmosphere.opacity,
      },
    ],
  };
}

function mapTileKind(kind: WorldViewTileKind): PixelWorldTileKind {
  if (kind === "grass" || kind === "pressed_grass" || kind === "worn_grass" || kind === "soil") return kind;
  if (kind === "exposed_soil" || kind === "built") return "soil";
  if (kind === "boundary") return "empty";
  return "grass";
}

function mapTraceKind(visualKind: string): PixelWorldTraceKind {
  if (visualKind.includes("foot")) return "footprint";
  if (visualKind.includes("soil")) return "bare_soil";
  if (visualKind.includes("maintain")) return "maintenance";
  if (visualKind.includes("recover")) return "recovery";
  if (visualKind.includes("wait")) return "waiting_spot";
  return "pressed_grass";
}

function mapObjectKind(kind: WorldViewObjectKind): PixelWorldObjectKind {
  if (kind === "tree" || kind === "stone" || kind === "facility") return kind;
  if (kind === "insect_signal") return "insect";
  if (kind === "structure") return "building";
  return "grass_tile";
}

function recipeIdForObjectKind(kind: PixelWorldObjectKind): string {
  if (kind === "tree") return "natural_tree_object_recipe";
  if (kind === "stone") return "natural_stone_object_recipe";
  if (kind === "insect") return "natural_insect_signal_recipe";
  if (kind === "building") return "world_building_placeholder_recipe";
  if (kind === "facility") return "world_facility_placeholder_recipe";
  return "natural_grass_tile_recipe";
}

function mapActorKind(kind: PixelWorldActorKind): PixelWorldActorKind {
  return kind;
}
