import {
  buildLegacyDebugTraceSamples,
  buildTraceEdgeGrassAnchors,
  buildTraceEdgeObjectAnchors,
  resolveTraceFallbackHalfWidth,
} from "./trace-edge-composer";
import type {
  PathSample,
  SceneAnchor,
  SceneComposerBiome,
  SceneComposerFact,
} from "./scene-composer-schema";

/**
 * @deprecated Compatibility wrapper for old debug callers.
 * Formal scene composition should use trace-edge-composer helpers.
 */
export function buildRoadSamples(fact: SceneComposerFact): PathSample[] {
  return buildLegacyDebugTraceSamples(fact);
}

/**
 * @deprecated Compatibility wrapper. Use resolveTraceFallbackHalfWidth.
 */
export function resolveRoadWidth(biome: SceneComposerBiome): number {
  return resolveTraceFallbackHalfWidth(biome);
}

/**
 * @deprecated Compatibility wrapper. Use buildTraceEdgeGrassAnchors.
 */
export function buildRoadsideGrassAnchors(
  pathSamples: PathSample[],
  seed: string
): SceneAnchor[] {
  return buildTraceEdgeGrassAnchors(pathSamples, seed);
}

/**
 * @deprecated Compatibility wrapper. Use buildTraceEdgeObjectAnchors.
 */
export function buildRoadsideObjectAnchors(
  pathSamples: PathSample[],
  seed: string
): SceneAnchor[] {
  return buildTraceEdgeObjectAnchors(pathSamples, seed);
}
