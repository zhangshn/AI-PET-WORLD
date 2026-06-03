// 该文件用于提供场景组合中的唯一树木绘制算法。

import type {
  PixelLayerKind,
  PixelPartId,
  PixelPrimitiveKind,
} from "../../pixel-primitives/pixel-primitive-schema";
import type { SceneObject, ScenePalette } from "./scene-composer-schema";

export type SceneComposerTreeBlockPlan = {
  primitiveKind: PixelPrimitiveKind;
  partId: PixelPartId;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  opacity: number;
  layer: PixelLayerKind;
};

type SceneComposerTreeMetrics = {
  health: number;
  stressLevel: number;
  scale: number;
  trunkWidth: number;
  trunkHeight: number;
  trunkX: number;
  trunkY: number;
  crownY: number;
  crownScale: number;
  leafMain: string;
  leafHighlight: string;
  leafRows: number[];
};

export function renderSceneComposerTreeShadow(object: SceneObject, palette: ScenePalette): string {
  const rx = Math.round(34 * object.scale);
  const ry = Math.round(10 * object.scale);

  return `<ellipse cx="${object.x}" cy="${object.y + 2}" rx="${rx}" ry="${ry}" fill="${palette.shadow}" opacity="0.42"/>`;
}

export function renderSceneComposerTreeObject(object: SceneObject, palette: ScenePalette): string {
  return buildSceneComposerTreeObjectBlockPlan(object, palette)
    .map(renderBlockPlanAsRect)
    .join("\n");
}

export function buildSceneComposerTreeBlockPlan(
  object: SceneObject,
  palette: ScenePalette
): SceneComposerTreeBlockPlan[] {
  return [
    buildSceneComposerTreeShadowBlockPlan(object, palette),
    ...buildSceneComposerTreeObjectBlockPlan(object, palette),
  ];
}

export function buildSceneComposerTreeShadowBlockPlan(
  object: SceneObject,
  palette: ScenePalette
): SceneComposerTreeBlockPlan {
  const rx = Math.round(34 * object.scale);
  const ry = Math.round(10 * object.scale);

  return {
    primitiveKind: "shadow_block",
    partId: "tree_shadow",
    x: object.x - rx,
    y: object.y + 2 - ry,
    width: rx * 2,
    height: ry * 2,
    color: palette.shadow,
    opacity: 0.42,
    layer: "shadow",
  };
}

export function buildSceneComposerTreeObjectBlockPlan(
  object: SceneObject,
  palette: ScenePalette
): SceneComposerTreeBlockPlan[] {
  const metrics = buildSceneComposerTreeMetrics(object, palette);

  return [
    {
      primitiveKind: "dark_block",
      partId: "tree_trunk",
      x: metrics.trunkX,
      y: metrics.trunkY,
      width: metrics.trunkWidth,
      height: metrics.trunkHeight,
      color: palette.trunkDark,
      opacity: 1,
      layer: "object",
    },
    {
      primitiveKind: "tall_block",
      partId: "tree_trunk",
      x: metrics.trunkX + Math.max(2, Math.round(metrics.trunkWidth * 0.28)),
      y: metrics.trunkY + 4,
      width: Math.max(4, Math.round(metrics.trunkWidth * 0.54)),
      height: metrics.trunkHeight - 6,
      color: palette.trunk,
      opacity: 1,
      layer: "object",
    },
    {
      primitiveKind: "highlight_block",
      partId: "tree_trunk_light",
      x: metrics.trunkX + metrics.trunkWidth - 4,
      y: metrics.trunkY + 12,
      width: 3,
      height: Math.round(metrics.trunkHeight * 0.52),
      color: palette.trunkLight,
      opacity: 1,
      layer: "object",
    },
    ...buildLeafClusterBlockPlans({
      cx: object.x + Math.round(20 * metrics.scale),
      cy: metrics.crownY + Math.round(20 * metrics.scale),
      scale: metrics.crownScale,
      color: palette.leafDark,
      rows: [4, 10, 18, 24, 25, 20, 11],
      partId: "tree_crown_dark",
    }),
    ...buildLeafClusterBlockPlans({
      cx: object.x - Math.round(8 * metrics.scale),
      cy: metrics.crownY + Math.round(14 * metrics.scale),
      scale: metrics.crownScale,
      color: metrics.leafMain,
      rows: metrics.leafRows,
      partId: "tree_crown_main",
    }),
    ...buildLeafClusterBlockPlans({
      cx: object.x - Math.round(23 * metrics.scale),
      cy: metrics.crownY + Math.round(21 * metrics.scale),
      scale: metrics.crownScale * 0.78,
      color: metrics.leafMain,
      rows: [4, 10, 16, 20, 18, 10],
      partId: "tree_crown_main",
    }),
    ...(metrics.stressLevel > 66
      ? []
      : buildLeafClusterBlockPlans({
          cx: object.x - Math.round(12 * metrics.scale),
          cy: metrics.crownY + Math.round(4 * metrics.scale),
          scale: metrics.crownScale * 0.68,
          color: metrics.leafHighlight,
          rows: [3, 7, 13, 15, 10, 4],
          partId: "tree_crown_highlight",
        })),
    ...buildLeafClusterBlockPlans({
      cx: object.x + Math.round(1 * metrics.scale),
      cy: metrics.crownY + Math.round(40 * metrics.scale),
      scale: metrics.crownScale * 0.86,
      color: palette.leafUnder,
      rows: [5, 14, 22, 24, 17, 8],
      partId: "tree_crown_under",
    }),
  ];
}

function buildSceneComposerTreeMetrics(
  object: SceneObject,
  palette: ScenePalette
): SceneComposerTreeMetrics {
  const health = object.health ?? 80;
  const stressLevel = object.stressLevel ?? 0;
  const stageScale =
    object.growthStage === "sprout"
      ? 0.48
      : object.growthStage === "young"
        ? 0.72
        : object.growthStage === "old"
          ? 1.08
          : object.growthStage === "declining"
            ? 0.86
            : 1;

  const scale = object.scale * stageScale;
  const trunkWidth = Math.round((8 + (object.age ?? 40) * 0.035) * scale);
  const trunkHeight = Math.round((38 + (object.age ?? 40) * 0.075) * scale);
  const trunkX = Math.round(object.x - trunkWidth / 2);
  const trunkY = Math.round(object.y - trunkHeight);
  const crownY = trunkY - Math.round(36 * scale);
  const crownScale = scale * (0.82 + health * 0.0022 - stressLevel * 0.0018);
  const leafMain = health < 42 ? palette.leafDark : palette.leaf;
  const leafHighlight = stressLevel > 62 || health < 46 ? palette.leaf : palette.leafLight;
  const leafRows =
    object.growthStage === "declining"
      ? [3, 8, 14, 18, 14, 7]
      : object.growthStage === "young"
        ? [4, 10, 16, 18, 14, 6]
        : [5, 13, 22, 28, 27, 20, 9];

  return {
    health,
    stressLevel,
    scale,
    trunkWidth,
    trunkHeight,
    trunkX,
    trunkY,
    crownY,
    crownScale,
    leafMain,
    leafHighlight,
    leafRows,
  };
}

function buildLeafClusterBlockPlans(input: {
  cx: number;
  cy: number;
  scale: number;
  color: string;
  rows: number[];
  partId: PixelPartId;
}): SceneComposerTreeBlockPlan[] {
  const rowHeight = Math.max(3, Math.round(4 * input.scale));
  const topY = Math.round(input.cy - (input.rows.length * rowHeight) / 2);

  return input.rows.map((row, index) => {
    const width = Math.max(6, Math.round(row * 3 * input.scale));
    const x = Math.round(input.cx - width / 2 + (index % 3) * 2);
    const y = topY + index * rowHeight;

    return {
      primitiveKind: "wide_block",
      partId: input.partId,
      x,
      y,
      width,
      height: rowHeight,
      color: input.color,
      opacity: 1,
      layer: "object",
    };
  });
}

function renderBlockPlanAsRect(block: SceneComposerTreeBlockPlan): string {
  const opacity = block.opacity >= 1 ? "" : ` opacity="${block.opacity}"`;

  return `<rect x="${block.x}" y="${block.y}" width="${block.width}" height="${block.height}" fill="${block.color}"${opacity}/>`;
}