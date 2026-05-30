// 该文件用于复用 Pixel Visual Lab 场景组合中的原始树木绘制算法。

import type { SceneObject, ScenePalette } from "./scene-composer-schema";

export function renderSceneComposerTreeShadow(object: SceneObject, palette: ScenePalette): string {
  const rx = Math.round(34 * object.scale);
  const ry = Math.round(10 * object.scale);
  return `<ellipse cx="${object.x}" cy="${object.y + 2}" rx="${rx}" ry="${ry}" fill="${palette.shadow}" opacity="0.42"/>`;
}

export function renderSceneComposerTreeObject(object: SceneObject, palette: ScenePalette): string {
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

  return [
    `<rect x="${trunkX}" y="${trunkY}" width="${trunkWidth}" height="${trunkHeight}" fill="${palette.trunkDark}"/>`,
    `<rect x="${trunkX + Math.max(2, Math.round(trunkWidth * 0.28))}" y="${trunkY + 4}" width="${Math.max(4, Math.round(trunkWidth * 0.54))}" height="${trunkHeight - 6}" fill="${palette.trunk}"/>`,
    `<rect x="${trunkX + trunkWidth - 4}" y="${trunkY + 12}" width="3" height="${Math.round(trunkHeight * 0.52)}" fill="${palette.trunkLight}"/>`,
    renderSceneComposerLeafCluster(object.x + Math.round(20 * scale), crownY + Math.round(20 * scale), crownScale, palette.leafDark, [4, 10, 18, 24, 25, 20, 11]),
    renderSceneComposerLeafCluster(object.x - Math.round(8 * scale), crownY + Math.round(14 * scale), crownScale, leafMain, leafRows),
    renderSceneComposerLeafCluster(object.x - Math.round(23 * scale), crownY + Math.round(21 * scale), crownScale * 0.78, leafMain, [4, 10, 16, 20, 18, 10]),
    stressLevel > 66
      ? ""
      : renderSceneComposerLeafCluster(object.x - Math.round(12 * scale), crownY + Math.round(4 * scale), crownScale * 0.68, leafHighlight, [3, 7, 13, 15, 10, 4]),
    renderSceneComposerLeafCluster(object.x + Math.round(1 * scale), crownY + Math.round(40 * scale), crownScale * 0.86, palette.leafUnder, [5, 14, 22, 24, 17, 8]),
  ].filter(Boolean).join("\n");
}

function renderSceneComposerLeafCluster(
  cx: number,
  cy: number,
  scale: number,
  color: string,
  rows: number[]
): string {
  const rowHeight = Math.max(3, Math.round(4 * scale));
  const topY = Math.round(cy - (rows.length * rowHeight) / 2);
  return rows
    .map((row, index) => {
      const width = Math.max(6, Math.round(row * 3 * scale));
      const x = Math.round(cx - width / 2 + (index % 3) * 2);
      const y = topY + index * rowHeight;
      return `<rect x="${x}" y="${y}" width="${width}" height="${rowHeight}" fill="${color}"/>`;
    })
    .join("\n");
}
