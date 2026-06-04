import { createEmptyPixelWorldViewModel } from "./pixel-worldview-model";
import type {
  PixelWorldActor,
  PixelWorldObject,
  PixelWorldTile,
  PixelWorldTrace,
  PixelWorldViewModel,
} from "./pixel-worldview-types";
import type {
  PixelWorldSourceActor,
  PixelWorldSourceObject,
  PixelWorldSourceSnapshot,
  PixelWorldSourceTile,
  PixelWorldSourceTrace,
} from "./pixel-worldview-source";

export function mapPixelWorldViewModelFromSnapshot(source: PixelWorldSourceSnapshot): PixelWorldViewModel {
  const model = createEmptyPixelWorldViewModel({
    worldId: source.worldId,
    tick: source.tick,
    width: source.width,
    height: source.height,
    tileSize: source.tileSize,
  });

  return {
    ...model,
    tiles: (source.tiles ?? []).map((tile) => mapTile(tile, model.canvas.tileSize)),
    traces: (source.traces ?? []).map(mapTrace),
    objects: (source.objects ?? []).map(mapObject).sort((left, right) => left.sortY - right.sortY),
    actors: (source.actors ?? []).map(mapActor).sort((left, right) => left.sortY - right.sortY),
    atmosphere: source.atmosphere ?? [],
  };
}

function mapTile(tile: PixelWorldSourceTile, tileSize: number): PixelWorldTile {
  return {
    id: tile.id ?? `tile_${tile.tileX}_${tile.tileY}`,
    layer: "tile",
    kind: tile.kind,
    x: tile.tileX * tileSize,
    y: tile.tileY * tileSize,
    tileX: tile.tileX,
    tileY: tile.tileY,
    variant: tile.variant ?? "default",
    walkable: tile.walkable ?? true,
    movementCost: tile.movementCost ?? 1,
    moisture: tile.moisture,
    ecologyHealth: tile.ecologyHealth,
    pressure: tile.pressure,
  };
}

function mapTrace(trace: PixelWorldSourceTrace, index: number): PixelWorldTrace {
  const strength = trace.strength ?? 1;

  return {
    id: trace.id ?? `trace_${index}_${trace.kind}`,
    sourceId: trace.sourceId,
    layer: "trace",
    kind: trace.kind,
    bounds: trace.bounds,
    strength,
    opacity: trace.opacity ?? clamp01(strength),
    age: trace.age,
  };
}

function mapObject(object: PixelWorldSourceObject, index: number): PixelWorldObject {
  return {
    id: object.id ?? `object_${index}_${object.kind}`,
    layer: "object",
    kind: object.kind,
    recipeId: object.recipeId,
    bounds: object.bounds,
    anchor: object.anchor,
    sortY: object.sortY ?? object.bounds.y + object.bounds.height,
    visible: object.visible ?? true,
    stateTags: object.stateTags,
  };
}

function mapActor(actor: PixelWorldSourceActor, index: number): PixelWorldActor {
  return {
    id: actor.id ?? `actor_${index}_${actor.kind}`,
    layer: "sprite",
    kind: actor.kind,
    bounds: actor.bounds,
    anchor: actor.anchor,
    sortY: actor.sortY ?? actor.bounds.y + actor.bounds.height,
    visible: actor.visible ?? true,
    stateTags: actor.stateTags,
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
