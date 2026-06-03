// 该文件用于把场景组合计划渲染为 SVG 预览。

import { SCENE_TILE_SIZE } from "./scene-composer-constants";
import { buildScenePalette } from "./scene-composer-palette";
import {
  renderSceneComposerTreeObject,
  renderSceneComposerTreeShadow,
} from "./scene-composer-tree-recipe";
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
  if (tile.visualKind === "pressed_grass") {
    return renderPressedGrassTile(tile, p);
  }

  if (tile.visualKind === "worn_grass") {
    return renderWornGrassTile(tile, p);
  }

  if (tile.visualKind === "exposed_soil") {
    return renderExposedSoilTile(tile, p);
  }

  if (tile.visualKind === "ecology_transition") {
    return renderEcologyTransitionTile(tile, p);
  }

  if (tile.visualKind === "recovery_growth") {
    return renderRecoveryGrowthTile(tile, p);
  }

  if (!tile.visualKind && tile.kind === "path") {
    return renderWornGrassTile(tile, p);
  }

  if (!tile.visualKind && tile.kind === "edge") {
    return renderEcologyTransitionTile(tile, p);
  }

  return renderGrassTile(tile, p);
}

function renderGrassTile(tile: SceneTile, p: ScenePalette): string {
  const color =
    tile.variant === 0 ? p.grassA : tile.variant === 1 ? p.grassB : p.grassC;
  return `<rect x="${tile.x}" y="${tile.y}" width="${SCENE_TILE_SIZE}" height="${SCENE_TILE_SIZE}" fill="${color}"/>`;
}

function renderPressedGrassTile(tile: SceneTile, p: ScenePalette): string {
  return [
    renderGrassTile(tile, p),
    `<rect x="${tile.x + tileOffset(tile, 0, 4)}" y="${tile.y + 5}" width="8" height="3" fill="${p.pressedGrass}" opacity="0.74"/>`,
    `<rect x="${tile.x + 3}" y="${tile.y + tileOffset(tile, 1, 13)}" width="12" height="3" fill="${p.grassDark}" opacity="0.34"/>`,
    `<rect x="${tile.x + 14}" y="${tile.y + tileOffset(tile, 2, 9)}" width="5" height="3" fill="${p.wornGrass}" opacity="0.34"/>`,
  ].join("\n");
}

function renderWornGrassTile(tile: SceneTile, p: ScenePalette): string {
  return [
    `<rect x="${tile.x}" y="${tile.y}" width="${SCENE_TILE_SIZE}" height="${SCENE_TILE_SIZE}" fill="${tile.variant % 2 === 0 ? p.wornGrass : p.pressedGrass}"/>`,
    renderTraceSpeckles(tile, p, 3, false),
    `<rect x="${tile.x + 5}" y="${tile.y + tileOffset(tile, 3, 8)}" width="11" height="3" fill="${p.grassDark}" opacity="0.28"/>`,
  ].join("\n");
}

function renderExposedSoilTile(tile: SceneTile, p: ScenePalette): string {
  return [
    `<rect x="${tile.x}" y="${tile.y}" width="${SCENE_TILE_SIZE}" height="${SCENE_TILE_SIZE}" fill="${tile.variant % 2 === 0 ? p.pressedGrass : p.wornGrass}"/>`,
    renderTraceSpeckles(tile, p, 5, true),
    `<rect x="${tile.x + tileOffset(tile, 4, 3)}" y="${tile.y + 16}" width="9" height="3" fill="${p.grassDark}" opacity="0.24"/>`,
  ].join("\n");
}

function renderEcologyTransitionTile(tile: SceneTile, p: ScenePalette): string {
  return [
    renderGrassTile(tile, p),
    `<rect x="${tile.x + tileOffset(tile, 5, 2)}" y="${tile.y + 4}" width="10" height="4" fill="${p.ecologyBlend}" opacity="0.56"/>`,
    `<rect x="${tile.x + 12}" y="${tile.y + tileOffset(tile, 6, 13)}" width="8" height="3" fill="${p.grassLight}" opacity="0.38"/>`,
    `<rect x="${tile.x + 4}" y="${tile.y + tileOffset(tile, 7, 17)}" width="5" height="3" fill="${p.recoveryGrass}" opacity="0.42"/>`,
  ].join("\n");
}

function renderRecoveryGrowthTile(tile: SceneTile, p: ScenePalette): string {
  return [
    renderGrassTile(tile, p),
    `<rect x="${tile.x + 5}" y="${tile.y + 13}" width="4" height="7" fill="${p.recoveryGrass}" opacity="0.72"/>`,
    `<rect x="${tile.x + 14}" y="${tile.y + 7}" width="3" height="6" fill="${p.grassLight}" opacity="0.58"/>`,
    `<rect x="${tile.x + 18}" y="${tile.y + 16}" width="3" height="5" fill="${p.recoveryGrass}" opacity="0.54"/>`,
  ].join("\n");
}

function renderTraceSpeckles(
  tile: SceneTile,
  p: ScenePalette,
  count: number,
  exposed: boolean
): string {
  return Array.from({ length: count }, (_, index) => {
    const x = tile.x + 2 + tileOffset(tile, index * 2, 16);
    const y = tile.y + 3 + tileOffset(tile, index * 2 + 1, 14);
    const width = exposed && index % 2 === 0 ? 7 : 4;
    const height = exposed ? 3 : 2;
    const color =
      index % 3 === 0 ? p.soilDark : index % 2 === 0 ? p.soilA : p.soilB;
    const opacity = exposed ? 0.62 : 0.38;
    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${color}" opacity="${opacity}"/>`;
  }).join("\n");
}

function tileOffset(tile: SceneTile, salt: number, range: number): number {
  const value = `${tile.id}:${tile.x}:${tile.y}:${salt}`;
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 9973;
  }

  return hash % Math.max(1, range);
}

function renderTileDecorations(
  tiles: SceneTile[],
  p: ScenePalette,
  moisture: number
): string {
  const wetRate = moisture / 100;
  return tiles
    .map((tile, index) => {
      if (
        tile.visualKind === "worn_grass" ||
        tile.visualKind === "exposed_soil" ||
        (!tile.visualKind && tile.kind === "path")
      ) {
        return index % 7 === 0
          ? `<rect x="${tile.x + 7}" y="${tile.y + 12}" width="6" height="3" fill="${p.soilDark}" opacity="0.38"/>`
          : `<rect x="${tile.x + 15}" y="${tile.y + 7}" width="3" height="3" fill="${p.soilLight}" opacity="0.28"/>`;
      }

      if (
        tile.visualKind === "ecology_transition" ||
        tile.visualKind === "recovery_growth" ||
        (!tile.visualKind && tile.kind === "edge")
      ) {
        return `<rect x="${tile.x + 6 + (index % 2) * 7}" y="${tile.y + 9 + (index % 3) * 4}" width="3" height="4" fill="${p.recoveryGrass}" opacity="${0.28 + wetRate * 0.22}"/>`;
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
  if (
    object.kind === "flower" ||
    object.kind === "mushroom" ||
    object.kind === "insect_signal"
  ) {
    return "";
  }

  if (object.kind === "tree") {
    return renderSceneComposerTreeShadow(object, p);
  }

  const rx = Math.round((object.kind === "actor" ? 12 : 16) * object.scale);
  const ry = Math.round(6 * object.scale);
  return `<ellipse cx="${object.x}" cy="${object.y + 2}" rx="${rx}" ry="${ry}" fill="${p.shadow}" opacity="0.42"/>`;
}

function renderSceneObject(object: SceneObject, p: ScenePalette): string {
  if (object.kind === "tree") return renderSceneComposerTreeObject(object, p);
  if (object.kind === "bush") return renderBush(object, p);
  if (object.kind === "stone") return renderStone(object, p);
  if (object.kind === "flower") return renderFlower(object, p);
  if (object.kind === "mushroom") return renderMushroom(object, p);
  if (object.kind === "insect_signal") return renderInsectSignal(object, p);

  return renderActor(object, p);
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
  const health = object.health ?? object.ecologyHealth ?? 72;
  const stressLevel = object.stressLevel ?? 0;
  const scale =
    object.scale *
    (object.growthStage === "declining" ? 0.82 : 0.92 + health * 0.0015);
  const main = health < 42 ? p.bushDark : p.bush;
  const light = stressLevel > 58 ? p.bush : p.bushLight;
  return [
    renderLeafCluster(object.x, object.y - Math.round(13 * scale), scale * 0.72, p.bushDark, [3, 7, 12, 13, 8, 3]),
    renderLeafCluster(object.x - Math.round(11 * scale), object.y - Math.round(10 * scale), scale * 0.58, main, [3, 8, 11, 8, 3]),
    renderLeafCluster(object.x + Math.round(9 * scale), object.y - Math.round(11 * scale), scale * 0.56, main, [3, 8, 10, 7, 3]),
    stressLevel > 70
      ? ""
      : `<rect x="${Math.round(object.x - 5 * scale)}" y="${Math.round(object.y - 24 * scale)}" width="6" height="3" fill="${light}"/>`,
  ].join("\n");
}

function renderStone(object: SceneObject, p: ScenePalette): string {
  const width = Math.round(17 * object.scale);
  const height = Math.round(9 * object.scale);
  const x = Math.round(object.x - width / 2);
  const y = Math.round(object.y - height);
  const stressLevel = object.stressLevel ?? 0;
  return [
    `<rect x="${x}" y="${y + 3}" width="${width}" height="${height}" fill="${p.stone}"/>`,
    `<rect x="${x + 4}" y="${y}" width="${Math.max(5, width - 8)}" height="4" fill="${stressLevel > 50 ? p.soilLight : p.stoneLight}"/>`,
  ].join("\n");
}

function renderFlower(object: SceneObject, p: ScenePalette): string {
  const x = Math.round(object.x);
  const y = Math.round(object.y);
  const health = object.health ?? object.ecologyHealth ?? 72;
  const stressLevel = object.stressLevel ?? 0;
  const bloomSize = stressLevel > 60 ? 2 : health > 72 ? 4 : 3;
  const bloomColor = health > 72 ? p.insectSignal : p.flower;
  return [
    `<rect x="${x}" y="${y - 9}" width="3" height="9" fill="${p.grassDark}"/>`,
    `<rect x="${x - bloomSize}" y="${y - 12}" width="${bloomSize}" height="${bloomSize}" fill="${bloomColor}"/>`,
    `<rect x="${x + 3}" y="${y - 12}" width="${bloomSize}" height="${bloomSize}" fill="${bloomColor}"/>`,
    `<rect x="${x}" y="${y - 15}" width="${bloomSize}" height="${bloomSize}" fill="${bloomColor}"/>`,
  ].join("\n");
}

function renderMushroom(object: SceneObject, p: ScenePalette): string {
  const x = Math.round(object.x);
  const y = Math.round(object.y);
  const scale = object.scale;
  const capWidth = Math.max(5, Math.round(9 * scale));
  const stemHeight = Math.max(4, Math.round(7 * scale));

  return [
    `<rect x="${x - Math.round(capWidth / 2)}" y="${y - stemHeight - 5}" width="${capWidth}" height="5" fill="${p.mushroomCap}"/>`,
    `<rect x="${x - 2}" y="${y - stemHeight}" width="4" height="${stemHeight}" fill="${p.mushroomStem}"/>`,
    `<rect x="${x + 1}" y="${y - stemHeight - 4}" width="2" height="2" fill="${p.soilLight}" opacity="0.55"/>`,
  ].join("\n");
}

function renderInsectSignal(object: SceneObject, p: ScenePalette): string {
  const x = Math.round(object.x);
  const y = Math.round(object.y);
  const opacity = 0.42 + ((object.ecologyHealth ?? 60) / 100) * 0.32;

  return [
    `<rect x="${x}" y="${y}" width="2" height="2" fill="${p.insectSignal}" opacity="${opacity}"/>`,
    `<rect x="${x + 5}" y="${y - 3}" width="2" height="2" fill="${p.insectSignal}" opacity="${opacity * 0.82}"/>`,
    `<rect x="${x - 4}" y="${y + 4}" width="2" height="2" fill="${p.insectSignal}" opacity="${opacity * 0.68}"/>`,
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