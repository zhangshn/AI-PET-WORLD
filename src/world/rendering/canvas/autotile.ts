/**
 * 当前文件负责：预留路径 autotile 的邻接选择规则。
 */

type GridPoint = {
  x: number
  y: number
}

const NORTH = 1
const EAST = 2
const SOUTH = 4
const WEST = 8

function buildPointKey(x: number, y: number): string {
  return `${x}:${y}`
}

function hasNeighbor(
  pathSet: ReadonlySet<string>,
  x: number,
  y: number
): boolean {
  return pathSet.has(buildPointKey(x, y))
}

const MASK_TO_CANDIDATE_ASSET_IDS: Record<number, string[]> = {
  0: ["path_dirt_single_01"],
  1: ["path_dirt_end_n_01", "path_dirt_vertical_01"],
  2: ["path_dirt_end_e_01", "path_dirt_horizontal_01"],
  4: ["path_dirt_end_s_01", "path_dirt_vertical_01"],
  8: ["path_dirt_end_w_01", "path_dirt_horizontal_01"],
  5: ["path_dirt_vertical_01"],
  10: ["path_dirt_horizontal_01"],
  3: ["path_dirt_corner_ne_01"],
  6: ["path_dirt_corner_se_01"],
  12: ["path_dirt_corner_sw_01"],
  9: ["path_dirt_corner_nw_01"],
  7: ["path_dirt_t_nes_01", "path_dirt_cross_01"],
  11: ["path_dirt_t_new_01", "path_dirt_cross_01"],
  13: ["path_dirt_t_nsw_01", "path_dirt_cross_01"],
  14: ["path_dirt_t_esw_01", "path_dirt_cross_01"],
  15: ["path_dirt_cross_01"],
}

export function selectPathAutotileAssetId(
  point: GridPoint,
  pathSet: ReadonlySet<string>,
  hasAsset: (assetId: string) => boolean,
  fallbackAssetId: string
): string {
  const mask =
    (hasNeighbor(pathSet, point.x, point.y - 1) ? NORTH : 0) |
    (hasNeighbor(pathSet, point.x + 1, point.y) ? EAST : 0) |
    (hasNeighbor(pathSet, point.x, point.y + 1) ? SOUTH : 0) |
    (hasNeighbor(pathSet, point.x - 1, point.y) ? WEST : 0)

  const candidates = MASK_TO_CANDIDATE_ASSET_IDS[mask] ?? [fallbackAssetId]

  return candidates.find(hasAsset) ?? fallbackAssetId
}
