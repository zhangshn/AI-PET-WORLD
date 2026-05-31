// 该文件用于把像素对象 recipe 输出渲染为 SVG 预览。

import { PIXEL_PALETTE } from "./pixel-style-foundation";
import type { PixelBlock, PixelObjectRecipeResult } from "./pixel-primitive-schema";

export function renderPixelObjectToSvg(result: PixelObjectRecipeResult): string {
  const width = 220;
  const height = 220;
  const sortedBlocks = [...result.blocks].sort((left, right) => layerOrder(left) - layerOrder(right));

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges" data-pixel-primitive-library="v1" data-object-kind="${escapeAttribute(result.kind)}" data-recipe-id="${escapeAttribute(result.recipeId)}" data-semantic-structure="${escapeAttribute(result.semanticStructureId)}">`,
    `<rect x="0" y="0" width="${width}" height="${height}" fill="${PIXEL_PALETTE.canvas}"/>`,
    ...sortedBlocks.map(renderPixelBlock),
    renderAnchorMarker(result),
    `</svg>`,
  ].join("\n");
}

export function renderPixelObjectToDataUri(result: PixelObjectRecipeResult): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderPixelObjectToSvg(result))}`;
}

function renderPixelBlock(block: PixelBlock): string {
  const opacity = block.opacity >= 1 ? "" : ` opacity="${block.opacity.toFixed(2)}"`;
  return `<rect data-primitive-kind="${escapeAttribute(block.primitiveKind)}" data-layer="${escapeAttribute(block.layer)}" x="${block.x}" y="${block.y}" width="${block.width}" height="${block.height}" fill="${block.color}"${opacity}/>`;
}

function renderAnchorMarker(result: PixelObjectRecipeResult): string {
  return `<rect data-anchor-type="${escapeAttribute(result.anchor.type)}" x="${result.anchor.x - 2}" y="${result.anchor.y - 2}" width="4" height="4" fill="#f3b6ff"/>`;
}

function layerOrder(block: PixelBlock): number {
  if (block.layer === "ground") return 10;
  if (block.layer === "trace") return 20;
  if (block.layer === "shadow") return 30;
  if (block.layer === "object") return 40;
  if (block.layer === "actor") return 50;
  if (block.layer === "foreground") return 60;
  return 70;
}

function escapeAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("\"", "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
