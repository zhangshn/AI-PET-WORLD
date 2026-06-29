import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import Module from "node:module"
import path from "node:path"
import ts from "typescript"

const require = createRequire(import.meta.url)
const originalResolveFilename = Module._resolveFilename

Module._resolveFilename = function resolveZiweiRouteAlias(
  request,
  parent,
  isMain,
  options
) {
  if (request.startsWith("@/")) {
    return originalResolveFilename(
      path.join(process.cwd(), "src", request.slice(2)),
      parent,
      isMain,
      options
    )
  }

  return originalResolveFilename(request, parent, isMain, options)
}

require.extensions[".ts"] = (module, filename) => {
  const source = readFileSync(filename, "utf8")
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX
    }
  }).outputText

  module._compile(output, filename)
}

const { POST } = require("../../src/app/api/ziwei/full-chart/route.ts")

const response = await POST(
  new Request("http://localhost/api/ziwei/full-chart", {
    method: "POST",
    body: JSON.stringify({
      birthInput: {
        calendarType: "solar",
        year: 1990,
        month: 5,
        day: 17,
        hour: 9,
        gender: "male"
      },
      dynamicInput: {
        currentAge: 36,
        currentYear: 2026,
        currentLunarMonth: 5,
        currentLunarDay: 13,
        currentTimeBranch: "si"
      }
    })
  })
)
const body = await response.json()

function fail(message) {
  console.error(`Ziwei API route check failed: ${message}`)
  process.exit(1)
}

if (response.status !== 200 || body.ok !== true) {
  fail(`expected 200 ok response, got ${response.status} ${JSON.stringify(body)}`)
}

if (body.data?.chart?.palaces?.length !== 12) {
  fail("expected 12 palaces in chart response")
}

if (body.data?.chart?.summary?.totalStarCount !== 103) {
  fail("expected 103 stars in chart summary")
}

if (body.data?.dynamicChart?.flows?.length !== 6) {
  fail("expected 6 dynamic flows")
}

if (body.data?.viewModel?.palaceGrid?.length !== 12) {
  fail("expected 12 palace cells in page view model")
}

if (body.data?.viewModel?.palaceDetails?.length !== 12) {
  fail("expected 12 palace details in page view model")
}

if (body.data?.viewModel?.dynamicTabs?.length !== 6) {
  fail("expected 6 dynamic tabs in page view model")
}

if (body.data?.viewModel?.dynamicTabs?.some((tab) => typeof tab.palace !== "string")) {
  fail("expected each dynamic tab to expose a palace branch")
}

if (body.data?.viewModel?.starCatalogRows?.length !== 103) {
  fail("expected 103 star rows in page view model")
}

if (body.data?.viewModel?.interpretation?.palaceInterpretations?.length !== 12) {
  fail("expected 12 palace interpretations in page view model")
}

if (body.data?.viewModel?.interpretation?.chartHighlights?.length !== 3) {
  fail("expected 3 chart highlights in page view model")
}

console.log("Ziwei API route check passed.")
