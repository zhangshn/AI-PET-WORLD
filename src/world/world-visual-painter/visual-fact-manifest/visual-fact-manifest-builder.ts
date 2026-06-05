import type {
  BuildWorldVisualPainterDecisionInput,
  WorldVisualConstructionFact,
  WorldVisualFactImportance,
  WorldVisualFactManifest,
  WorldVisualFactRef,
  WorldVisualMapDiffFact,
  WorldVisualPlacementFact,
  WorldVisualRecentEventFact,
  WorldVisualResourceFact,
  WorldVisualZoneFact,
} from "../world-visual-painter-schema"

export function buildWorldVisualFactManifest(
  input: BuildWorldVisualPainterDecisionInput
): WorldVisualFactManifest {
  const saveRecord = input.saveRecord
  const homeMapState = saveRecord.homeMapState
  const constructionPlans = homeMapState?.constructionPlans ?? []
  const placements = homeMapState?.placements ?? []
  const zones = homeMapState?.zones ?? []
  const mapDiffs = homeMapState?.mapDiffs ?? []
  const zoneFacts = zones.map<WorldVisualZoneFact>((zone) => ({
    id: zone.id,
    zoneType: zone.type,
    name: zone.name,
    purpose: zone.purpose,
    bounds: zone.bounds,
    importance: zoneImportance(zone.type),
    tags: zone.tags,
  }))
  const placementFacts = placements.map<WorldVisualPlacementFact>((placement) => ({
    id: placement.id,
    assetId: placement.assetId,
    layer: placement.layer,
    coordinate: { x: placement.x, y: placement.y },
    scale: placement.scale,
    alpha: placement.alpha,
    label: placement.label,
    source: placement.source,
    importance: placementImportance(placement.layer, placement.source),
    tags: placement.tags,
  }))
  const constructionFacts = constructionPlans.map<WorldVisualConstructionFact>(
    (plan) => ({
      id: plan.id,
      title: plan.title,
      targetZoneType: plan.targetZoneType,
      status: plan.status,
      progress: plan.progress,
      reason: plan.reason,
      importance: constructionImportance(plan.status),
      tags: plan.tags,
    })
  )
  const mapDiffFacts = mapDiffs.map<WorldVisualMapDiffFact>((diff) => ({
    id: diff.id,
    operation: diff.operation,
    placementId: diff.placementId,
    reason: diff.reason,
    createdAt: diff.createdAt,
    importance: mapDiffImportance(diff.operation),
    tags: diff.tags,
  }))
  const resourceFact = buildResourceFact(homeMapState.resources)
  const recentEventFacts = saveRecord.recentEvents.map<WorldVisualRecentEventFact>(
    (event) => ({
      id: event.id,
      tick: event.tick,
      title: event.title,
      body: event.body,
      source: event.source,
      importance: event.source === "construction" ? "supporting" : "ambient",
      tags: event.tags,
    })
  )
  const sourceFactIds = [
    saveRecord.worldId,
    ...zoneFacts.map((zone) => zone.id),
    ...placementFacts.map((placement) => placement.id),
    ...constructionFacts.map((plan) => plan.id),
    ...mapDiffFacts.map((diff) => diff.id),
    ...recentEventFacts.map((event) => event.id),
  ]
  const factRefs = buildFactRefs({
    worldId: saveRecord.worldId,
    zoneFacts,
    placementFacts,
    constructionFacts,
    mapDiffFacts,
    recentEventFacts,
  })

  return {
    worldId: saveRecord.worldId,
    tick: saveRecord.tick,
    factSource: "world_runtime_save_record",
    hasRuntimeWorld: true,
    hasButlerProfile: Boolean(saveRecord.butlerProfile),
    hasHomeMapState: Boolean(homeMapState),
    hasTraceField: Boolean(saveRecord.traceField),
    hasConstructionState: constructionPlans.some((plan) =>
      ["planned", "active"].includes(plan.status)
    ),
    zoneCount: zones.length,
    placementCount: placements.length,
    constructionPlanCount: constructionPlans.length,
    recentEventCount: saveRecord.recentEvents.length,
    sourceFactIds,
    primaryFacts: factRefs.filter((fact) => fact.importance === "primary"),
    supportingFacts: factRefs.filter((fact) => fact.importance === "supporting"),
    ambientFacts: factRefs.filter((fact) => fact.importance === "ambient"),
    zoneFacts,
    placementFacts,
    constructionFacts,
    mapDiffFacts,
    resourceFact,
    recentEventFacts,
    tags: [
      "world_facts_only",
      "visual_expression_not_generated",
      "runtime_facts_preserved",
    ],
  }
}

function buildResourceFact(
  resources: BuildWorldVisualPainterDecisionInput["saveRecord"]["homeMapState"]["resources"]
): WorldVisualResourceFact {
  return {
    groundHealth: resources.groundHealth,
    naturalGrowth: resources.naturalGrowth,
    materialReadiness: resources.materialReadiness,
    careReadiness: resources.careReadiness,
    spacePressure: resources.spacePressure,
    importance: "supporting",
    tags: resources.tags,
  }
}

function buildFactRefs(input: {
  worldId: string
  zoneFacts: WorldVisualZoneFact[]
  placementFacts: WorldVisualPlacementFact[]
  constructionFacts: WorldVisualConstructionFact[]
  mapDiffFacts: WorldVisualMapDiffFact[]
  recentEventFacts: WorldVisualRecentEventFact[]
}): WorldVisualFactRef[] {
  return [
    {
      sourceId: input.worldId,
      sourceType: "world",
      importance: "primary",
      label: {
        zh: "当前世界",
        en: "Current World",
      },
      tags: ["world_fact"],
    },
    ...input.zoneFacts.map<WorldVisualFactRef>((zone) => ({
      sourceId: zone.id,
      sourceType: "zone",
      importance: zone.importance,
      label: {
        zh: `区域：${zone.name}`,
        en: `Zone: ${zone.zoneType}`,
      },
      tags: zone.tags,
    })),
    ...input.placementFacts.map<WorldVisualFactRef>((placement) => ({
      sourceId: placement.id,
      sourceType: "placement",
      importance: placement.importance,
      label: {
        zh: `放置物：${placement.label}`,
        en: `Placement: ${placement.assetId}`,
      },
      tags: placement.tags,
    })),
    ...input.constructionFacts.map<WorldVisualFactRef>((plan) => ({
      sourceId: plan.id,
      sourceType: "construction_plan",
      importance: plan.importance,
      label: {
        zh: `建设计划：${plan.title}`,
        en: `Construction Plan: ${plan.status}`,
      },
      tags: plan.tags,
    })),
    ...input.mapDiffFacts.map<WorldVisualFactRef>((diff) => ({
      sourceId: diff.id,
      sourceType: "map_diff",
      importance: diff.importance,
      label: {
        zh: `地图变化：${diff.operation}`,
        en: `Map Diff: ${diff.operation}`,
      },
      tags: diff.tags,
    })),
    ...input.recentEventFacts.map<WorldVisualFactRef>((event) => ({
      sourceId: event.id,
      sourceType: "recent_event",
      importance: event.importance,
      label: {
        zh: `最近事件：${event.title}`,
        en: `Recent Event: ${event.source}`,
      },
      tags: event.tags,
    })),
  ]
}

function zoneImportance(zoneType: string): WorldVisualFactImportance {
  if (zoneType === "visual_center") return "primary"
  if (zoneType === "temporary_shelter" || zoneType === "entry_area") {
    return "supporting"
  }
  return "ambient"
}

function placementImportance(
  layer: string,
  source: string
): WorldVisualFactImportance {
  if (source === "construction_plan") return "primary"
  if (layer === "structure" || layer === "facility" || layer === "path") {
    return "supporting"
  }
  return "ambient"
}

function constructionImportance(status: string): WorldVisualFactImportance {
  if (status === "active" || status === "planned") return "primary"
  if (status === "paused") return "supporting"
  return "ambient"
}

function mapDiffImportance(operation: string): WorldVisualFactImportance {
  if (operation === "add" || operation === "move") return "supporting"
  return "ambient"
}
