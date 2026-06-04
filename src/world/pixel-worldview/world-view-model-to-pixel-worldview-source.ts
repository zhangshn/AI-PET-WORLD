import type {
  WorldViewModel,
  WorldViewObjectKind,
  WorldViewTileKind,
  WorldViewTrace,
} from "@/world/world-view-model";

import type {
  PixelWorldActorKind,
  PixelWorldObjectKind,
  PixelWorldTileKind,
  PixelWorldTraceKind,
} from "./pixel-worldview-types";
import type { PixelWorldSourceSnapshot, PixelWorldSourceTrace } from "./pixel-worldview-source";

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
    traces: model.traces.flatMap((trace) =>
      mapTraceToReadableSegments({
        trace,
        tileSize: model.canvas.tileSize,
        canvasWidth: model.canvas.width,
        canvasHeight: model.canvas.height,
      })
    ),
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

function mapTraceToReadableSegments(input: {
  trace: WorldViewTrace;
  tileSize: number;
  canvasWidth: number;
  canvasHeight: number;
}): PixelWorldSourceTrace[] {
  const { trace, tileSize } = input;
  const tags = trace.tags ?? [];
  const storyRole = tags.find((tag) => tag.startsWith("story_trace_role:"))?.slice("story_trace_role:".length);

  if (tags.includes("story_staging_trace")) {
    return mapStoryTraceToReadableSegments({
      trace,
      tileSize,
      canvasWidth: input.canvasWidth,
      canvasHeight: input.canvasHeight,
      storyRole,
    });
  }

  const segmentCount = Math.max(3, Math.min(10, Math.ceil(trace.radius / 12) + Math.ceil(trace.intensity / 28)));
  const kind = mapTraceKind(trace.visualKind);
  const seed = stableHash(`${trace.id}:${trace.x}:${trace.y}:${trace.radius}`);
  const angle = ((seed % 120) - 60) * (Math.PI / 180);
  const direction = {
    x: Math.cos(angle),
    y: Math.sin(angle) * 0.62,
  };
  const normal = {
    x: -direction.y,
    y: direction.x,
  };
  const segmentWidth = Math.max(8, Math.min(18, Math.round(tileSize * 0.72)));
  const segmentHeight = Math.max(4, Math.min(10, Math.round(tileSize * 0.34)));

  return Array.from({ length: segmentCount }, (_, index) => {
    const progress = segmentCount === 1 ? 0 : index / (segmentCount - 1);
    const spread = (progress - 0.5) * trace.radius * 1.45;
    const jitter = ((stableHash(`${trace.id}:${index}`) % 100) / 100 - 0.5) * tileSize * 0.65;
    const x = Math.round(trace.x + direction.x * spread + normal.x * jitter - segmentWidth / 2);
    const y = Math.round(trace.y + direction.y * spread + normal.y * jitter - segmentHeight / 2);

    return {
      id: `${trace.id}_segment_${index}`,
      sourceId: trace.id,
      kind,
      bounds: {
        x: clampInt(x, 0, Math.max(0, input.canvasWidth - segmentWidth)),
        y: clampInt(y, 0, Math.max(0, input.canvasHeight - segmentHeight)),
        width: segmentWidth,
        height: segmentHeight,
      },
      strength: trace.intensity / 100,
      opacity: trace.opacity,
      stateTags: tags,
    };
  });
}

function mapStoryTraceToReadableSegments(input: {
  trace: WorldViewTrace;
  tileSize: number;
  canvasWidth: number;
  canvasHeight: number;
  storyRole?: string;
}): PixelWorldSourceTrace[] {
  if (input.storyRole === "access_path") {
    return mapStoryAccessPathSegments(input);
  }

  return mapStoryAreaSegments(input);
}

function mapStoryAreaSegments(input: {
  trace: WorldViewTrace;
  tileSize: number;
  canvasWidth: number;
  canvasHeight: number;
  storyRole?: string;
}): PixelWorldSourceTrace[] {
  const { trace, tileSize } = input;
  const kind = mapTraceKind(trace.visualKind);
  const width =
    input.storyRole === "foundation_pad"
      ? Math.round(tileSize * 5.8)
      : input.storyRole === "worked_ground"
        ? Math.round(tileSize * 4.8)
        : Math.round(tileSize * 3.6);
  const height =
    input.storyRole === "foundation_pad"
      ? Math.round(tileSize * 2.2)
      : input.storyRole === "worked_ground"
        ? Math.round(tileSize * 1.8)
        : Math.round(tileSize * 1.2);
  const offsets =
    input.storyRole === "foundation_pad"
      ? [
          { x: 0, y: 0, w: 1, h: 1 },
          { x: -0.35, y: 0.48, w: 0.42, h: 0.5 },
          { x: 0.32, y: 0.42, w: 0.36, h: 0.45 },
        ]
      : [
          { x: 0, y: 0, w: 1, h: 1 },
          { x: -0.28, y: 0.36, w: 0.34, h: 0.42 },
          { x: 0.28, y: -0.28, w: 0.28, h: 0.32 },
        ];

  return offsets.map((offset, index) => {
    const segmentWidth = Math.max(10, Math.round(width * offset.w));
    const segmentHeight = Math.max(6, Math.round(height * offset.h));
    const x = Math.round(trace.x + width * offset.x - segmentWidth / 2);
    const y = Math.round(trace.y + height * offset.y - segmentHeight / 2);

    return {
      id: `${trace.id}_area_${index}`,
      sourceId: trace.sourceId ?? trace.id,
      kind,
      bounds: {
        x: clampInt(x, 0, Math.max(0, input.canvasWidth - segmentWidth)),
        y: clampInt(y, 0, Math.max(0, input.canvasHeight - segmentHeight)),
        width: segmentWidth,
        height: segmentHeight,
      },
      strength: trace.intensity / 100,
      opacity: trace.opacity,
      stateTags: trace.tags,
    };
  });
}

function mapStoryAccessPathSegments(input: {
  trace: WorldViewTrace;
  tileSize: number;
  canvasWidth: number;
  canvasHeight: number;
}): PixelWorldSourceTrace[] {
  const { trace, tileSize } = input;
  const kind = mapTraceKind(trace.visualKind);
  const segmentWidth = Math.round(tileSize * 2.6);
  const segmentHeight = Math.round(tileSize * 0.58);
  const crossWidth = Math.round(tileSize * 1.1);
  const crossHeight = Math.round(tileSize * 0.42);

  return [
    {
      id: `${trace.id}_path_main`,
      sourceId: trace.sourceId ?? trace.id,
      kind,
      bounds: {
        x: clampInt(Math.round(trace.x - segmentWidth / 2), 0, Math.max(0, input.canvasWidth - segmentWidth)),
        y: clampInt(Math.round(trace.y - segmentHeight / 2), 0, Math.max(0, input.canvasHeight - segmentHeight)),
        width: segmentWidth,
        height: segmentHeight,
      },
      strength: trace.intensity / 100,
      opacity: trace.opacity,
      stateTags: trace.tags,
    },
    {
      id: `${trace.id}_path_edge`,
      sourceId: trace.sourceId ?? trace.id,
      kind,
      bounds: {
        x: clampInt(Math.round(trace.x - crossWidth / 2 + tileSize * 0.55), 0, Math.max(0, input.canvasWidth - crossWidth)),
        y: clampInt(Math.round(trace.y + segmentHeight * 0.45), 0, Math.max(0, input.canvasHeight - crossHeight)),
        width: crossWidth,
        height: crossHeight,
      },
      strength: trace.intensity / 100,
      opacity: Math.max(0.12, trace.opacity * 0.72),
      stateTags: trace.tags,
    },
  ];
}

function mapTileKind(kind: WorldViewTileKind): PixelWorldTileKind {
  if (
    kind === "grass" ||
    kind === "pressed_grass" ||
    kind === "worn_grass" ||
    kind === "soil" ||
    kind === "ecology_transition" ||
    kind === "recovery_growth" ||
    kind === "built"
  ) return kind;
  if (kind === "exposed_soil") return "soil";
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

function stableHash(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash >>> 0);
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
