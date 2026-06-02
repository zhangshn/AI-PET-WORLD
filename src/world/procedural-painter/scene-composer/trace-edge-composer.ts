import {
  SCENE_HEIGHT,
} from "./scene-composer-constants";
import { clamp, stableUnit } from "./scene-composer-random";
import type {
  SceneAnchor,
  SceneComposerBiome,
  SceneTraceSample,
} from "./scene-composer-schema";

export function resolveTraceFallbackHalfWidth(
  biome: SceneComposerBiome
): number {
  if (biome === "desert") return 1.9;
  if (biome === "grassland") return 1.45;
  return 1.3;
}

export function buildTraceEdgeGrassAnchors(
  traceSamples: SceneTraceSample[],
  seed: string
): SceneAnchor[] {
  return traceSamples.flatMap((sample) => buildTraceEdgeAnchorsForSample(sample, seed, 2, 14, 4, 84, SCENE_HEIGHT - 14));
}

export function buildTraceEdgeObjectAnchors(
  traceSamples: SceneTraceSample[],
  seed: string
): SceneAnchor[] {
  return traceSamples.flatMap((sample) => buildTraceEdgeAnchorsForSample(sample, seed, 4, 18, 10, 92, SCENE_HEIGHT - 42));
}

function buildTraceEdgeAnchorsForSample(
  sample: SceneTraceSample,
  seed: string,
  columnModulo: number,
  maxOffset: number,
  yPadding: number,
  minY: number,
  maxY: number
): SceneAnchor[] {
  if (sample.column % columnModulo !== (columnModulo === 2 ? 0 : 1)) {
    return [];
  }

  return (["top", "bottom"] as const).map((side, sideIndex) => {
    const offset = Math.round(
      (stableUnit(`${seed}:offset:${sample.column}:${side}`) - 0.5) * maxOffset
    );
    const y =
      side === "top"
        ? sample.topY - yPadding - offset
        : sample.bottomY + yPadding + offset;
    const xSpread = columnModulo === 2 ? 18 : 22;

    return {
      id: `${sample.column}_${side}`,
      x: Math.round(
        sample.x +
          (stableUnit(`${seed}:x:${sample.column}:${side}`) - 0.5) * xSpread
      ),
      y: clamp(y, minY, maxY),
      rank: stableUnit(`${seed}:rank:${sample.column}:${side}`),
      roll: stableUnit(`${seed}:kind:${sample.column}:${side}`),
      scaleRoll: stableUnit(`${seed}:scale:${sample.column}:${side}`),
      ageRoll: stableUnit(`${seed}:age:${sample.column}:${sideIndex}`),
      healthRoll: stableUnit(`${seed}:health:${sample.column}:${sideIndex}`),
    };
  });
}
