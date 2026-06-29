import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const mainCatalogPath = path.join(
  root,
  "src",
  "ai",
  "destiny-core",
  "ziwei-core",
  "star-catalog",
  "main-star-catalog.ts",
)
const assistantCatalogPath = path.join(
  root,
  "src",
  "ai",
  "destiny-core",
  "ziwei-core",
  "star-catalog",
  "assistant-star-catalog.ts",
)
const maleficCatalogPath = path.join(
  root,
  "src",
  "ai",
  "destiny-core",
  "ziwei-core",
  "star-catalog",
  "malefic-star-catalog.ts",
)
const transformationCatalogPath = path.join(
  root,
  "src",
  "ai",
  "destiny-core",
  "ziwei-core",
  "star-catalog",
  "transformation-star-catalog.ts",
)
const miscCatalogPath = path.join(
  root,
  "src",
  "ai",
  "destiny-core",
  "ziwei-core",
  "star-catalog",
  "misc-star-catalog.ts",
)
const lifecycleCatalogPath = path.join(
  root,
  "src",
  "ai",
  "destiny-core",
  "ziwei-core",
  "star-catalog",
  "lifecycle-star-catalog.ts",
)
const yearlyCatalogPath = path.join(
  root,
  "src",
  "ai",
  "destiny-core",
  "ziwei-core",
  "star-catalog",
  "yearly-star-catalog.ts",
)
const monthlyCatalogPath = path.join(
  root,
  "src",
  "ai",
  "destiny-core",
  "ziwei-core",
  "star-catalog",
  "monthly-star-catalog.ts",
)
const dailyHourlyCatalogPath = path.join(
  root,
  "src",
  "ai",
  "destiny-core",
  "ziwei-core",
  "star-catalog",
  "daily-hourly-star-catalog.ts",
)

function fail(message) {
  console.error(`Ziwei star catalog check failed: ${message}`)
  process.exit(1)
}

if (!existsSync(mainCatalogPath)) {
  fail("main-star-catalog.ts is missing")
}

const text = readFileSync(mainCatalogPath, "utf8")
const assistantText = existsSync(assistantCatalogPath)
  ? readFileSync(assistantCatalogPath, "utf8")
  : ""
const maleficText = existsSync(maleficCatalogPath)
  ? readFileSync(maleficCatalogPath, "utf8")
  : ""
const transformationText = existsSync(transformationCatalogPath)
  ? readFileSync(transformationCatalogPath, "utf8")
  : ""
const miscText = existsSync(miscCatalogPath)
  ? readFileSync(miscCatalogPath, "utf8")
  : ""
const lifecycleText = existsSync(lifecycleCatalogPath)
  ? readFileSync(lifecycleCatalogPath, "utf8")
  : ""
const yearlyText = existsSync(yearlyCatalogPath)
  ? readFileSync(yearlyCatalogPath, "utf8")
  : ""
const monthlyText = existsSync(monthlyCatalogPath)
  ? readFileSync(monthlyCatalogPath, "utf8")
  : ""
const dailyHourlyText = existsSync(dailyHourlyCatalogPath)
  ? readFileSync(dailyHourlyCatalogPath, "utf8")
  : ""

for (let index = 1; index <= 14; index += 1) {
  const legacyStarId = `star_${String(index).padStart(2, "0")}`
  if (!text.includes(`legacyStarId: "${legacyStarId}"`)) {
    fail(`missing legacy mapping for ${legacyStarId}`)
  }
}

const mainCategoryCount = Array.from(text.matchAll(/category:\s*"main"/g)).length
if (mainCategoryCount !== 14) {
  fail(`expected 14 main category definitions, got ${mainCategoryCount}`)
}

const displayOrderCount = Array.from(text.matchAll(/displayOrder:\s*\d+/g)).length
if (displayOrderCount !== 14) {
  fail(`expected 14 displayOrder definitions, got ${displayOrderCount}`)
}

if (!assistantText) {
  fail("assistant-star-catalog.ts is missing")
}

const assistantCategoryCount = Array.from(
  assistantText.matchAll(/category:\s*"assistant"/g),
).length
if (assistantCategoryCount !== 8) {
  fail(`expected 8 assistant category definitions, got ${assistantCategoryCount}`)
}

if (!maleficText) {
  fail("malefic-star-catalog.ts is missing")
}

const maleficCategoryCount = Array.from(
  maleficText.matchAll(/category:\s*"malefic"/g),
).length
if (maleficCategoryCount !== 6) {
  fail(`expected 6 malefic category definitions, got ${maleficCategoryCount}`)
}

if (!transformationText) {
  fail("transformation-star-catalog.ts is missing")
}

const transformationCategoryCount = Array.from(
  transformationText.matchAll(/category:\s*"transformation"/g),
).length
if (transformationCategoryCount !== 4) {
  fail(
    `expected 4 transformation category definitions, got ${transformationCategoryCount}`,
  )
}

if (!miscText) {
  fail("misc-star-catalog.ts is missing")
}

const miscCategoryCount = Array.from(
  miscText.matchAll(/category:\s*"misc"/g),
).length
if (miscCategoryCount !== 15) {
  fail(`expected 15 misc category definitions, got ${miscCategoryCount}`)
}

if (!lifecycleText) {
  fail("lifecycle-star-catalog.ts is missing")
}

const lifecycleCategoryCount = Array.from(
  lifecycleText.matchAll(/category:\s*"lifecycle"/g),
).length
if (lifecycleCategoryCount !== 12) {
  fail(
    `expected 12 lifecycle category definitions, got ${lifecycleCategoryCount}`,
  )
}

if (!yearlyText) {
  fail("yearly-star-catalog.ts is missing")
}

const yearlyCategoryCount = Array.from(
  yearlyText.matchAll(/category:\s*"yearly"/g),
).length
if (yearlyCategoryCount !== 36) {
  fail(`expected 36 yearly category definitions, got ${yearlyCategoryCount}`)
}

if (!monthlyText) {
  fail("monthly-star-catalog.ts is missing")
}

const monthlyCategoryCount = Array.from(
  monthlyText.matchAll(/category:\s*"monthly"/g),
).length
if (monthlyCategoryCount !== 4) {
  fail(`expected 4 monthly category definitions, got ${monthlyCategoryCount}`)
}

if (!dailyHourlyText) {
  fail("daily-hourly-star-catalog.ts is missing")
}

const dailyHourlyCategoryCount = Array.from(
  dailyHourlyText.matchAll(/category:\s*"dailyHourly"/g),
).length
if (dailyHourlyCategoryCount !== 4) {
  fail(
    `expected 4 dailyHourly category definitions, got ${dailyHourlyCategoryCount}`,
  )
}

console.log("Ziwei star catalog check passed.")
