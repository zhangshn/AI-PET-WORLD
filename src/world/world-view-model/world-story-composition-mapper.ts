import type {
  WorldViewCanvas,
  WorldViewObject,
  WorldViewTrace,
} from "./world-view-model-schema"

export function buildWorldStoryCompositionTraces(input: {
  objects: WorldViewObject[]
  canvas: WorldViewCanvas
}): WorldViewTrace[] {
  const anchors = input.objects
    .filter(isWorldStoryAnchorObject)
    .sort((left, right) => left.y - right.y || left.x - right.x)

  return [
    ...anchors.flatMap((object) =>
      buildStoryAnchorTraceSet({
        object,
        canvas: input.canvas,
      })
    ),
    ...buildInterAnchorNetworkTraces({
      anchors,
      canvas: input.canvas,
    }),
  ]
}

function buildStoryAnchorTraceSet(input: {
  object: WorldViewObject
  canvas: WorldViewCanvas
}): WorldViewTrace[] {
  const { object, canvas } = input
  const tile = canvas.tileSize
  const anchorX = clamp(object.x, tile * 2, canvas.width - tile * 2)
  const anchorY = clamp(object.y + tile * 1.2, tile * 2, canvas.height - tile * 2)
  const entranceX = clamp(anchorX + tile * 1.4, tile * 2, canvas.width - tile * 2)
  const entranceY = clamp(anchorY + tile * 2.2, tile * 2, canvas.height - tile * 2)
  const lowerPathTarget = {
    x: clamp(canvas.width * 0.42, tile * 2, canvas.width - tile * 2),
    y: clamp(canvas.height * 0.78, tile * 2, canvas.height - tile * 2),
  }

  return [
    {
      id: `world_view_story_staging_trace_${object.id}_foundation`,
      sourceId: object.id,
      visualKind: "maintained_area",
      x: anchorX,
      y: anchorY,
      radius: tile * 4.2,
      intensity: 82,
      opacity: 0.34,
      layer: "surface",
      tags: buildStoryTraceTags({
        object,
        role: "foundation_pad",
      }),
    },
    {
      id: `world_view_story_staging_trace_${object.id}_worked_ground`,
      sourceId: object.id,
      visualKind: "exposed_soil",
      x: entranceX,
      y: entranceY,
      radius: tile * 3.4,
      intensity: 72,
      opacity: 0.32,
      layer: "surface",
      tags: buildStoryTraceTags({
        object,
        role: "worked_ground",
      }),
    },
    {
      id: `world_view_story_staging_trace_${object.id}_staging_edge`,
      sourceId: object.id,
      visualKind: "flattened_grass",
      x: clamp(anchorX - tile * 2.8, tile * 2, canvas.width - tile * 2),
      y: clamp(anchorY + tile * 1.1, tile * 2, canvas.height - tile * 2),
      radius: tile * 2.8,
      intensity: 58,
      opacity: 0.22,
      layer: "surface",
      tags: buildStoryTraceTags({
        object,
        role: "staging_edge",
      }),
    },
    ...buildPathTraceChain({
      sourceObjectId: object.id,
      start: { x: entranceX, y: entranceY },
      end: lowerPathTarget,
      tileSize: tile,
    }),
  ]
}

function buildInterAnchorNetworkTraces(input: {
  anchors: WorldViewObject[]
  canvas: WorldViewCanvas
}): WorldViewTrace[] {
  if (input.anchors.length < 2) return []

  return input.anchors.slice(1).flatMap((anchor, index) => {
    const previous = input.anchors[index]

    return buildConnectionTraceChain({
      left: previous,
      right: anchor,
      canvas: input.canvas,
      connectionIndex: index,
    })
  })
}

function buildConnectionTraceChain(input: {
  left: WorldViewObject
  right: WorldViewObject
  canvas: WorldViewCanvas
  connectionIndex: number
}): WorldViewTrace[] {
  const tile = input.canvas.tileSize
  const leftPoint = storyObjectEntrancePoint({
    object: input.left,
    canvas: input.canvas,
  })
  const rightPoint = storyObjectEntrancePoint({
    object: input.right,
    canvas: input.canvas,
  })
  const distance = Math.hypot(rightPoint.x - leftPoint.x, rightPoint.y - leftPoint.y)
  const segmentCount = Math.max(3, Math.min(9, Math.ceil(distance / (tile * 5))))

  return Array.from({ length: segmentCount }, (_, index) => {
    const progress = (index + 1) / (segmentCount + 1)
    const x = lerp(leftPoint.x, rightPoint.x, progress)
    const y = lerp(leftPoint.y, rightPoint.y, progress)

    return {
      id: `world_view_story_staging_trace_network_${input.left.id}_${input.right.id}_${input.connectionIndex}_${index}`,
      sourceId: input.left.id,
      visualKind: index % 2 === 0 ? "worn_ground" : "flattened_grass",
      x,
      y,
      radius: tile * 2.2,
      intensity: 62,
      opacity: 0.24,
      layer: "surface",
      tags: [
        "world_story_composition_projection",
        "story_staging_trace",
        "fact_backed_visual_projection",
        "read_only_projection",
        "no_runtime_write",
        "story_trace_role:anchor_network_path",
        `source_object:${input.left.id}`,
        `connected_source_object:${input.right.id}`,
      ],
    }
  })
}

function buildPathTraceChain(input: {
  sourceObjectId: string
  start: { x: number; y: number }
  end: { x: number; y: number }
  tileSize: number
}): WorldViewTrace[] {
  const segmentCount = 5

  return Array.from({ length: segmentCount }, (_, index) => {
    const progress = (index + 1) / (segmentCount + 1)
    const curve = Math.sin(progress * Math.PI) * input.tileSize * 1.4
    const x = lerp(input.start.x, input.end.x, progress) + curve
    const y = lerp(input.start.y, input.end.y, progress)

    return {
      id: `world_view_story_staging_trace_${input.sourceObjectId}_access_${index}`,
      sourceId: input.sourceObjectId,
      visualKind: index % 2 === 0 ? "worn_ground" : "flattened_grass",
      x,
      y,
      radius: input.tileSize * 2.4,
      intensity: 68 - index * 4,
      opacity: 0.28,
      layer: "surface",
      tags: [
        "world_story_composition_projection",
        "story_staging_trace",
        "fact_backed_visual_projection",
        "read_only_projection",
        "no_runtime_write",
        "story_trace_role:access_path",
        `source_object:${input.sourceObjectId}`,
      ],
    }
  })
}

function storyObjectEntrancePoint(input: {
  object: WorldViewObject
  canvas: WorldViewCanvas
}): { x: number; y: number } {
  const tile = input.canvas.tileSize
  const anchorX = clamp(input.object.x, tile * 2, input.canvas.width - tile * 2)
  const anchorY = clamp(input.object.y + tile * 1.2, tile * 2, input.canvas.height - tile * 2)

  return {
    x: clamp(anchorX + tile * 1.4, tile * 2, input.canvas.width - tile * 2),
    y: clamp(anchorY + tile * 2.2, tile * 2, input.canvas.height - tile * 2),
  }
}

function buildStoryTraceTags(input: {
  object: WorldViewObject
  role: "foundation_pad" | "worked_ground" | "staging_edge"
}): string[] {
  return [
    "world_story_composition_projection",
    "story_staging_trace",
    "fact_backed_visual_projection",
    "read_only_projection",
    "no_runtime_write",
    `story_trace_role:${input.role}`,
    `source_object:${input.object.id}`,
    ...input.object.tags.filter(
      (tag) =>
        tag === "butler_construction_result" ||
        tag === "construction_plan_add_diff" ||
        tag.startsWith("construction_stage:") ||
        tag.startsWith("construction_project:") ||
        tag.includes("care_station") ||
        tag.includes("under_construction")
    ),
  ]
}

function isWorldStoryAnchorObject(object: WorldViewObject): boolean {
  if (object.source !== "world_fact") return false
  if (object.kind !== "facility" && object.kind !== "structure") return false

  return object.tags.some(
    (tag) =>
      tag === "butler_construction_result" ||
      tag === "construction_plan_add_diff" ||
      tag.startsWith("construction_stage:") ||
      tag.startsWith("construction_project:") ||
      tag.includes("care_station") ||
      tag.includes("under_construction") ||
      tag.includes("event")
  )
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
