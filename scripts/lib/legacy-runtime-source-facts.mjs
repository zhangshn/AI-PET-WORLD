// Source identifiers for the legacy home-map save format.
// Preserve order and duplicates; this is not a natural-world identity validator.
export function buildSourceFactIds(saveRecord) {
  const homeMapState = saveRecord.homeMapState ?? {}
  const zones = Array.isArray(homeMapState.zones) ? homeMapState.zones : []
  const placements = Array.isArray(homeMapState.placements) ? homeMapState.placements : []
  const constructionPlans = Array.isArray(homeMapState.constructionPlans)
    ? homeMapState.constructionPlans
    : []
  const mapDiffs = Array.isArray(homeMapState.mapDiffs) ? homeMapState.mapDiffs : []
  const recentEvents = Array.isArray(saveRecord.recentEvents) ? saveRecord.recentEvents : []
  const connectivity = homeMapState.worldConnectivity ?? null

  return [
    saveRecord.worldId,
    ...zones.map((zone) => zone.id),
    ...placements.map((placement) => placement.id),
    ...constructionPlans.map((plan) => plan.id),
    ...mapDiffs.map((diff) => diff.id),
    ...recentEvents.map((event) => event.id),
    ...buildConnectivityFactIds(connectivity),
  ].filter((id) => typeof id === "string" && id.trim().length > 0)
}

function buildConnectivityFactIds(connectivity) {
  if (!connectivity) return []
  return [
    connectivity.contractId,
    connectivity.blueprintId,
    connectivity.currentRegion?.regionId,
    ...(connectivity.currentRegion?.neighborRegionIds ?? []),
    ...(connectivity.currentRegion?.edgePorts ?? []),
    connectivity.pathGraph?.pathGraphId,
    connectivity.hydrologyGraph?.hydrologyGraphId,
    connectivity.walkableGraph?.walkableGraphId,
  ]
}
