import { buildRoadSamples } from "./road-composer";
import type {
  SceneComposerFact,
  SceneTraceField,
  SceneTraceSample,
} from "./scene-composer-schema";

// Movement trace wrapper around the legacy sample builder.
export function buildMovementTraceSamples(
  fact: SceneComposerFact
): SceneTraceSample[] {
  return buildRoadSamples({
    ...fact,
    // Deprecated compatibility: the legacy implementation still reads roadShape.
    roadShape: fact.traceShape,
  });
}

export function buildMovementTraceField(input: {
  fact: SceneComposerFact;
  samples: SceneTraceSample[];
}): SceneTraceField {
  return {
    kind: "movement",
    traceShape: input.fact.traceShape,
    traceDensity: input.fact.traceDensity,
    hasTraceFact: input.fact.hasTraceFact ?? true,
    facts: input.fact.traceFacts ?? [],
    samples: input.samples,
  };
}
