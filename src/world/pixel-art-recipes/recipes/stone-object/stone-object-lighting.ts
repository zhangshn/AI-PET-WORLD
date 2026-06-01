// 该文件用于处理自然石头像素对象的分面光影。

import { cloneGrid, isGridEdge } from "../../core/grid-utils";
import type { StoneGrid, StoneTemplate } from "./stone-object-types";

export function applyStoneLightingField(grid: StoneGrid, template: StoneTemplate): StoneGrid {
  const next = cloneGrid(grid);

  for (let y = 0; y < template.gridHeight; y += 1) {
    for (let x = 0; x < template.gridWidth; x += 1) {
      const cell = next[y][x];
      if (!cell.filled) continue;

      const edge = isGridEdge(grid, x, y);
      const topBoundary = topPlaneBoundary(template, x);
      const frontBoundary = frontPlaneBoundary(template, x);
      const rightBoundary = rightPlaneBoundary(template, y);
      const topPlane = y <= topBoundary;
      const frontPlane = y > topBoundary && y <= frontBoundary;
      const leftLightPlane = x < template.gridWidth * 0.5 && y < template.gridHeight * 0.62;
      const rightDarkPlane = x >= rightBoundary && y > topBoundary + 1;
      const bottomPlane = y > template.gridHeight * 0.7;

      if (edge && (rightDarkPlane || bottomPlane || x < template.gridWidth * 0.12)) {
        cell.tone = "outline";
      } else if (topPlane || leftLightPlane) {
        cell.tone = "light";
      } else if (rightDarkPlane) {
        cell.tone = "dark";
      } else if (bottomPlane) {
        cell.tone = "ambientDark";
      } else if (frontPlane) {
        cell.tone = "main";
      } else {
        cell.tone = "main";
      }
    }
  }

  return next;
}

export function isNearStonePlaneBoundary(template: StoneTemplate, x: number, y: number): boolean {
  const top = Math.abs(y - topPlaneBoundary(template, x)) <= 1;
  const front = Math.abs(y - frontPlaneBoundary(template, x)) <= 1;
  const right = Math.abs(x - rightPlaneBoundary(template, y)) <= 1;
  return top || front || right;
}

function topPlaneBoundary(template: StoneTemplate, x: number): number {
  const centerX = template.gridWidth * 0.5;
  return 6 + Math.round((x - centerX) * 0.08 + Math.sin((x / template.gridWidth) * Math.PI * 2) * 1.2);
}

function frontPlaneBoundary(template: StoneTemplate, x: number): number {
  const centerX = template.gridWidth * 0.5;
  return 14 - Math.round((x - centerX) * 0.12);
}

function rightPlaneBoundary(template: StoneTemplate, y: number): number {
  return 20 + Math.round(Math.sin((y / template.gridHeight) * Math.PI) * 1.5);
}
