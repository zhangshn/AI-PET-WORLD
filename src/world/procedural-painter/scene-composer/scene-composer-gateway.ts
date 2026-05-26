import type {
  SceneComposerFact,
  SceneCompositionPlan,
} from "./scene-composer-schema";
import {
  buildDefaultSceneComposerFact as buildDefaultSceneComposerFactInternal,
  composeScene as composeSceneInternal,
} from "./scene-composer";
import { renderScenePlanToSvg } from "./scene-svg-renderer";

export function buildDefaultSceneComposerFact(
  input: Partial<SceneComposerFact> = {}
): SceneComposerFact {
  return buildDefaultSceneComposerFactInternal(input);
}

export function composeScene(fact: SceneComposerFact): SceneCompositionPlan {
  return composeSceneInternal(fact);
}

export function buildSceneSvg(fact: SceneComposerFact): string {
  return renderScenePlanToSvg(composeSceneInternal(fact));
}
