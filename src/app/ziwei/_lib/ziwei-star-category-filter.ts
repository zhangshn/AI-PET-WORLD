import type {
  ZiweiStarCatalogRowView,
  ZiweiStarCategory
} from "@/ai/destiny-core/ziwei-core/contracts"

export type StarCatalogCategoryFilter = ZiweiStarCategory | "all"

export function buildStarCatalogCategoryFilterValues(
  rows: ZiweiStarCatalogRowView[]
): StarCatalogCategoryFilter[] {
  const categories = new Set<StarCatalogCategoryFilter>(["all"])

  rows.forEach((row) => {
    if (row.category !== "empty") {
      categories.add(row.category)
    }
  })

  return Array.from(categories)
}
