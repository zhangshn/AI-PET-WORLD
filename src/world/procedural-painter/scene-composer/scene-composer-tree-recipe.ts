// 该文件用于复用 Pixel Visual Lab 场景组合中的原始树木绘制算法。

import type { SceneObject, ScenePalette } from "./scene-composer-schema";

export function renderSceneComposerTreeShadow(object: SceneObject, palette: ScenePalette): string {
  const scale = object.scale;
  const rx = Math.round(34 * scale);
  const ry = Math.round(10 * scale);
  const innerRx = Math.round(20 * scale);
  const innerRy = Math.round(6 * scale);

  return [
    `<ellipse cx="${object.x}" cy="${object.y + 3}" rx="${rx}" ry="${ry}" fill="${palette.shadow}" opacity="0.36"/>`,
    `<ellipse cx="${object.x + Math.round(5 * scale)}" cy="${object.y + 1}" rx="${innerRx}" ry="${innerRy}" fill="${palette.shadow}" opacity="0.22"/>`,
  ].join("\n");
}

export function renderSceneComposerTreeObject(object: SceneObject, palette: ScenePalette): string {
  const health = object.health ?? 80;
  const age = object.age ?? 40;
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
  const trunkWidth = Math.round((8 + age * 0.035) * scale);
  const trunkHeight = Math.round((38 + age * 0.075) * scale);
  const trunkX = Math.round(object.x - trunkWidth / 2);
  const trunkY = Math.round(object.y - trunkHeight);
  const crownY = trunkY - Math.round(36 * scale);
  const crownScale = scale * (0.82 + health * 0.0022 - stressLevel * 0.0018);
  const leafMain = health < 42 ? palette.leafDark : palette.leaf;
  const leafHighlight = stressLevel > 62 || health < 46 ? palette.leaf : palette.leafLight;
  const mainRows =
    object.growthStage === "declining"
      ? [3, 8, 14, 18, 14, 7]
      : object.growthStage === "young"
        ? [4, 10, 16, 18, 14, 6]
        : [5, 13, 22, 28, 27, 20, 9];

  return [
    renderSceneComposerTreeBranches(object, palette, scale, trunkX, trunkY, trunkWidth),
    renderSceneComposerTreeTrunk(object, palette, scale, trunkX, trunkY, trunkWidth, trunkHeight),
    renderSceneComposerLeafCluster({ cx: object.x + Math.round(22 * scale), cy: crownY + Math.round(23 * scale), scale: crownScale, color: palette.leafDark, rows: [4, 10, 18, 24, 25, 20, 11], offsets: [1, -1, 2, 0, 3, 1, -2] }),
    renderSceneComposerLeafCluster({ cx: object.x - Math.round(8 * scale), cy: crownY + Math.round(14 * scale), scale: crownScale, color: leafMain, rows: mainRows, offsets: [-1, 2, -2, 1, 3, 0, -2] }),
    renderSceneComposerLeafCluster({ cx: object.x - Math.round(24 * scale), cy: crownY + Math.round(22 * scale), scale: crownScale * 0.78, color: leafMain, rows: [4, 10, 16, 20, 18, 10], offsets: [0, -2, 1, -1, 2, 0] }),
    renderSceneComposerLeafCluster({ cx: object.x + Math.round(10 * scale), cy: crownY + Math.round(5 * scale), scale: crownScale * 0.58, color: leafHighlight, rows: [2, 6, 11, 13, 8, 3], offsets: [0, 2, -1, 1, -2, 0] }),
    stressLevel > 66
      ? ""
      : renderSceneComposerLeafCluster({ cx: object.x - Math.round(15 * scale), cy: crownY + Math.round(3 * scale), scale: crownScale * 0.62, color: leafHighlight, rows: [3, 7, 12, 14, 9, 4], offsets: [1, -1, 2, 0, -2, 1] }),
    renderSceneComposerLeafCluster({ cx: object.x + Math.round(2 * scale), cy: crownY + Math.round(42 * scale), scale: crownScale * 0.86, color: palette.leafUnder, rows: [5, 14, 22, 24, 17, 8], offsets: [-2, 1, 0, 3, 1, -1] }),
    renderSceneComposerLeafNoise(object, palette, crownY, crownScale, health, stressLevel),
  ].filter(Boolean).join("\n");
}

function renderSceneComposerTreeTrunk(
  object: SceneObject,
  palette: ScenePalette,
  scale: number,
  trunkX: number,
  trunkY: number,
  trunkWidth: number,
  trunkHeight: number
): string {
  const rootY = object.y - Math.round(5 * scale);
  const mainX = trunkX + Math.max(2, Math.round(trunkWidth * 0.26));
  const mainWidth = Math.max(4, Math.round(trunkWidth * 0.56));
  const lightX = trunkX + trunkWidth - Math.max(4, Math.round(4 * scale));

  return [
    `<rect x="${trunkX}" y="${trunkY}" width="${trunkWidth}" height="${trunkHeight}" fill="${palette.trunkDark}"/>`,
    `<rect x="${mainX}" y="${trunkY + Math.round(4 * scale)}" width="${mainWidth}" height="${trunkHeight - Math.round(6 * scale)}" fill="${palette.trunk}"/>`,
    `<rect x="${lightX}" y="${trunkY + Math.round(11 * scale)}" width="${Math.max(2, Math.round(3 * scale))}" height="${Math.round(trunkHeight * 0.52)}" fill="${palette.trunkLight}"/>`,
    `<rect x="${trunkX - Math.round(6 * scale)}" y="${rootY}" width="${Math.round(12 * scale)}" height="${Math.max(2, Math.round(4 * scale))}" fill="${palette.trunkDark}"/>`,
    `<rect x="${trunkX + trunkWidth - Math.round(2 * scale)}" y="${rootY + Math.round(2 * scale)}" width="${Math.round(11 * scale)}" height="${Math.max(2, Math.round(3 * scale))}" fill="${palette.trunk}"/>`,
    `<rect x="${trunkX + Math.round(trunkWidth * 0.18)}" y="${trunkY + Math.round(trunkHeight * 0.38)}" width="${Math.max(2, Math.round(3 * scale))}" height="${Math.max(2, Math.round(3 * scale))}" fill="${palette.trunkDark}" opacity="0.72"/>`,
    `<rect x="${trunkX + Math.round(trunkWidth * 0.55)}" y="${trunkY + Math.round(trunkHeight * 0.64)}" width="${Math.max(2, Math.round(3 * scale))}" height="${Math.max(2, Math.round(2 * scale))}" fill="${palette.trunkLight}" opacity="0.72"/>`,
  ].join("\n");
}

function renderSceneComposerTreeBranches(
  object: SceneObject,
  palette: ScenePalette,
  scale: number,
  trunkX: number,
  trunkY: number,
  trunkWidth: number
): string {
  if (object.growthStage === "sprout") return "";

  const branchY = trunkY + Math.round(18 * scale);
  const branchHeight = Math.max(2, Math.round(4 * scale));

  return [
    `<rect x="${trunkX - Math.round(17 * scale)}" y="${branchY + Math.round(4 * scale)}" width="${Math.round(20 * scale)}" height="${branchHeight}" fill="${palette.trunkDark}" opacity="0.72"/>`,
    `<rect x="${trunkX + trunkWidth - Math.round(2 * scale)}" y="${branchY}" width="${Math.round(24 * scale)}" height="${branchHeight}" fill="${palette.trunkDark}" opacity="0.68"/>`,
  ].join("\n");
}

function renderSceneComposerLeafCluster(input: {
  cx: number;
  cy: number;
  scale: number;
  color: string;
  rows: number[];
  offsets: number[];
}): string {
  const rowHeight = Math.max(3, Math.round(4 * input.scale));
  const topY = Math.round(input.cy - (input.rows.length * rowHeight) / 2);

  return input.rows
    .map((row, index) => {
      const bite = index % 4 === 1 ? Math.round(2 * input.scale) : 0;
      const width = Math.max(6, Math.round(row * 3 * input.scale) - bite);
      const x = Math.round(input.cx - width / 2 + (input.offsets[index] ?? 0) * input.scale);
      const y = topY + index * rowHeight;
      return `<rect x="${x}" y="${y}" width="${width}" height="${rowHeight}" fill="${input.color}"/>`;
    })
    .join("\n");
}

function renderSceneComposerLeafNoise(
  object: SceneObject,
  palette: ScenePalette,
  crownY: number,
  crownScale: number,
  health: number,
  stressLevel: number
): string {
  const shouldShowBrightNoise = health > 50 && stressLevel < 70;
  const bright = shouldShowBrightNoise ? palette.leafLight : palette.leaf;
  const dark = health < 44 ? palette.leafDark : palette.leafUnder;
  const dots = [
    { x: -22, y: 10, color: bright, w: 5, h: 3 },
    { x: 8, y: 2, color: bright, w: 7, h: 3 },
    { x: 30, y: 24, color: dark, w: 8, h: 4 },
    { x: -4, y: 42, color: dark, w: 10, h: 4 },
    { x: -34, y: 31, color: dark, w: 7, h: 3 },
  ];

  return dots
    .map((dot, index) => {
      const x = Math.round(object.x + dot.x * crownScale);
      const y = Math.round(crownY + dot.y * crownScale);
      const width = Math.max(2, Math.round(dot.w * crownScale));
      const height = Math.max(2, Math.round(dot.h * crownScale));
      const opacity = index < 2 ? 0.82 : 0.76;
      return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${dot.color}" opacity="${opacity}"/>`;
    })
    .join("\n");
}
