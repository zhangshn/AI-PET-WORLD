import {
  SCENE_TILE_SIZE,
} from "./scene-composer-constants";
import { buildScenePalette } from "./scene-composer-palette";
import type {
  SceneCompositionPlan,
  SceneGrassTuft,
  SceneObject,
  ScenePalette,
  SceneTile,
} from "./scene-composer-schema";

export type SceneSvgRendererOptions = {
  showDebugOverlay?: boolean;
};

export function renderScenePlanToSvg(
  plan: SceneCompositionPlan,
  options: SceneSvgRendererOptions = {}
): string {
  const palette = buildScenePalette(plan.biome, plan.moisture);
  const objectsByDepth = [...plan.objects].sort((left, right) => left.y - right.y);
  const debugOverlay = options.showDebugOverlay
    ? `<text x="18" y="28" font-size="13" fill="#e6f4e6" font-family="monospace">${escapeText(plan.biome)} moisture=${plan.moisture} decorationDensity=${plan.decorationDensity} traceShape=${plan.traceShape} trace=${plan.hasTraceFact ? "saved" : "none"}</text>`
    : "";

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${plan.width}" height="${plan.height}" viewBox="0 0 ${plan.width} ${plan.height}" shape-rendering="crispEdges" role="img" aria-label="AI-PET-WORLD pixel scene composer preview">`,
    `<rect x="0" y="0" width="${plan.width}" height="${plan.height}" fill="${palette.bg}"/>`,
    plan.tiles.map((tile) => renderTile(tile, palette)).join("\n"),
    renderTileDecorations(plan.tiles, palette, plan.moisture),
    plan.grassTufts
      .filter((tuft) => tuft.layer === "back")
      .map((tuft) => renderGrassTuft(tuft, palette))
      .join("\n"),
    objectsByDepth.map((object) => renderObjectShadow(object, palette)).join("\n"),
    objectsByDepth.map((object) => renderSceneObject(object, palette)).join("\n"),
    plan.grassTufts
      .filter((tuft) => tuft.layer !== "back")
      .map((tuft) => renderGrassTuft(tuft, palette))
      .join("\n"),
    debugOverlay,
    `</svg>`,
  ].filter(Boolean).join("\n");
}

function renderTile(tile: SceneTile, p: ScenePalette): string {
  if (tile.kind === "path") {
    return `<rect x="${tile.x}" y="${tile.y}" width="${SCENE_TILE_SIZE}" height="${SCENE_TILE_SIZE}" fill="${tile.variant % 2 === 0 ? p.pathA : p.pathB}"/>`;
  }

  if (tile.kind === "edge") {
    const base = tile.variant % 2 === 0 ? p.grassB : p.grassA;
    const edgeY = tile.edgeMask === "top" ? tile.y + 14 : tile.y;
    return [
      `<rect x="${tile.x}" y="${tile.y}" width="${SCENE_TILE_SIZE}" height="${SCENE_TILE_SIZE}" fill="${base}"/>`,
      `<rect x="${tile.x}" y="${edgeY}" width="${SCENE_TILE_SIZE}" height="10" fill="${p.pathA}" opacity="0.9"/>`,
      `<rect x="${tile.x + 3}" y="${edgeY + 1}" width="6" height="3" fill="${p.grassLight}" opacity="0.72"/>`,
      `<rect x="${tile.x + 15}" y="${edgeY + 5}" width="6" height="3" fill="${p.grassDark}" opacity="0.5"/>`,
    ].join("\n");
  }

  const color =
    tile.variant === 0 ? p.grassA : tile.variant === 1 ? p.grassB : p.grassC;
  return `<rect x="${tile.x}" y="${tile.y}" width="${SCENE_TILE_SIZE}" height="${SCENE_TILE_SIZE}" fill="${color}"/>`;
}

function renderTileDecorations(
  tiles: SceneTile[],
  p: ScenePalette,
  moisture: number
): string {
  const wetRate = moisture / 100;
  return tiles
    .filter((tile) => tile.kind !== "edge")
    .map((tile, index) => {
      if (tile.kind === "path") {
        return index % 7 === 0
          ? `<rect x="${tile.x + 7}" y="${tile.y + 12}" width="6" height="3" fill="${p.pathDark}" opacity="0.52"/>`
          : `<rect x="${tile.x + 15}" y="${tile.y + 7}" width="3" height="3" fill="${p.pathLight}" opacity="0.45"/>`;
      }

      const accent = index % 5 === 0 ? p.grassLight : p.grassDark;
      const opacity = index % 5 === 0 ? 0.22 + wetRate * 0.22 : 0.18 + wetRate * 0.18;
      return `<rect x="${tile.x + 5 + (index % 3) * 5}" y="${tile.y + 8 + (index % 4) * 3}" width="3" height="3" fill="${accent}" opacity="${opacity}"/>`;
    })
    .join("\n");
}

function renderGrassTuft(tuft: SceneGrassTuft, p: ScenePalette): string {
  const color = tuft.light ? p.grassLight : p.grassDark;
  return [
    `<rect x="${tuft.x}" y="${tuft.y - tuft.height}" width="3" height="${tuft.height}" fill="${color}"/>`,
    `<rect x="${tuft.x + 3}" y="${tuft.y - Math.max(2, tuft.height - 3)}" width="3" height="${Math.max(2, tuft.height - 3)}" fill="${tuft.light ? p.grassA : p.grassDark}" opacity="0.86"/>`,
  ].join("\n");
}

function renderObjectShadow(object: SceneObject, p: ScenePalette): string {
  if (object.kind === "flower") {
    return "";
  }

  const rx = Math.round((object.kind === "tree" ? 34 : object.kind === "actor" ? 12 : 16) * object.scale);
  const ry = Math.round((object.kind === "tree" ? 10 : 6) * object.scale);
  return `<ellipse cx="${object.x}" cy="${object.y + 2}" rx="${rx}" ry="${ry}" fill="${p.shadow}" opacity="0.42"/>`;
}

function renderSceneObject(object: SceneObject, p: ScenePalette): string {
  if (object.kind === "tree") return renderTree(object, p);
  if (object.kind === "bush") return renderBush(object, p);
  if (object.kind === "stone") return renderStone(object, p);
  if (object.kind === "flower") return renderFlower(object, p);

  return renderActor(object, p);
}

function renderTree(object: SceneObject, p: ScenePalette): string {
  const scale = object.scale;
  const trunkWidth = Math.round((9 + (object.age ?? 40) * 0.04) * scale);
  const trunkHeight = Math.round((45 + (object.age ?? 40) * 0.08) * scale);
  const trunkX = Math.round(object.x - trunkWidth / 2);
  const trunkY = Math.round(object.y - trunkHeight);
  const crownY = trunkY - Math.round(36 * scale);
  const crownScale = scale * (0.9 + (object.health ?? 80) * 0.002);

  return [
    `<rect x="${trunkX}" y="${trunkY}" width="${trunkWidth}" height="${trunkHeight}" fill="${p.trunkDark}"/>`,
    `<rect x="${trunkX + Math.max(2, Math.round(trunkWidth * 0.28))}" y="${trunkY + 4}" width="${Math.max(4, Math.round(trunkWidth * 0.54))}" height="${trunkHeight - 6}" fill="${p.trunk}"/>`,
    `<rect x="${trunkX + trunkWidth - 4}" y="${trunkY + 12}" width="3" height="${Math.round(trunkHeight * 0.52)}" fill="${p.trunkLight}"/>`,
    renderLeafCluster(object.x + Math.round(20 * scale), crownY + Math.round(20 * scale), crownScale, p.leafDark, [4, 10, 18, 24, 25, 20, 11]),
    renderLeafCluster(object.x - Math.round(8 * scale), crownY + Math.round(14 * scale), crownScale, p.leaf, [5, 13, 22, 28, 27, 20, 9]),
    renderLeafCluster(object.x - Math.round(23 * scale), crownY + Math.round(21 * scale), crownScale * 0.78, p.leaf, [4, 10, 16, 20, 18, 10]),
    renderLeafCluster(object.x - Math.round(12 * scale), crownY + Math.round(4 * scale), crownScale * 0.68, p.leafLight, [3, 7, 13, 15, 10, 4]),
    renderLeafCluster(object.x + Math.round(1 * scale), crownY + Math.round(40 * scale), crownScale * 0.86, p.leafUnder, [5, 14, 22, 24, 17, 8]),
  ].join("\n");
}

function renderLeafCluster(
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

function renderBush(object: SceneObject, p: ScenePalette): string {
  const scale = object.scale;
  return [
    renderLeafCluster(object.x, object.y - Math.round(13 * scale), scale * 0.72, p.bushDark, [3, 7, 12, 13, 8, 3]),
    renderLeafCluster(object.x - Math.round(11 * scale), object.y - Math.round(10 * scale), scale * 0.58, p.bush, [3, 8, 11, 8, 3]),
    renderLeafCluster(object.x + Math.round(9 * scale), object.y - Math.round(11 * scale), scale * 0.56, p.bush, [3, 8, 10, 7, 3]),
    `<rect x="${Math.round(object.x - 5 * scale)}" y="${Math.round(object.y - 24 * scale)}" width="6" height="3" fill="${p.bushLight}"/>`,
  ].join("\n");
}

function renderStone(object: SceneObject, p: ScenePalette): string {
  const width = Math.round(17 * object.scale);
  const height = Math.round(9 * object.scale);
  const x = Math.round(object.x - width / 2);
  const y = Math.round(object.y - height);
  return [
    `<rect x="${x}" y="${y + 3}" width="${width}" height="${height}" fill="${p.stone}"/>`,
    `<rect x="${x + 4}" y="${y}" width="${Math.max(5, width - 8)}" height="4" fill="${p.stoneLight}"/>`,
  ].join("\n");
}

function renderFlower(object: SceneObject, p: ScenePalette): string {
  const x = Math.round(object.x);
  const y = Math.round(object.y);
  return [
    `<rect x="${x}" y="${y - 9}" width="3" height="9" fill="${p.grassDark}"/>`,
    `<rect x="${x - 3}" y="${y - 12}" width="3" height="3" fill="${p.flower}"/>`,
    `<rect x="${x + 3}" y="${y - 12}" width="3" height="3" fill="${p.flower}"/>`,
    `<rect x="${x}" y="${y - 15}" width="3" height="3" fill="${p.flower}"/>`,
  ].join("\n");
}

function renderActor(object: SceneObject, p: ScenePalette): string {
  const x = Math.round(object.x);
  const y = Math.round(object.y);
  return [
    `<rect x="${x - 9}" y="${y - 27}" width="18" height="18" fill="${p.actorDark}"/>`,
    `<rect x="${x - 6}" y="${y - 36}" width="15" height="15" fill="${p.actor}"/>`,
    `<rect x="${x - 3}" y="${y - 30}" width="3" height="3" fill="#122017"/>`,
    `<rect x="${x - 6}" y="${y - 9}" width="6" height="9" fill="${p.actorDark}"/>`,
    `<rect x="${x + 3}" y="${y - 9}" width="6" height="9" fill="${p.actorDark}"/>`,
  ].join("\n");
}

function escapeText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
