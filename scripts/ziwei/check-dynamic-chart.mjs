import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import ts from "typescript"

const require = createRequire(import.meta.url)

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

const {
  buildFullZiweiChart,
  buildFullZiweiDynamicChart
} = require("../../src/ai/destiny-core/ziwei-core/public-api")
const {
  buildLegacyBirthPattern
} = require("../../src/ai/destiny-core/ziwei-core/adapters")
const {
  buildZiweiDynamicChart
} = require("../../src/ai/destiny-core/ziwei-core/dynamic/dynamic-flow-engine")

const samples = [
  {
    birth: {
      name: "dynamic-sample-forward",
      gender: "male",
      calendar: "solar",
      year: 1990,
      month: 5,
      day: 17,
      hour: 9
    },
    dynamicInput: {
      currentAge: 36,
      currentYear: 2026,
      currentLunarMonth: 5,
      currentLunarDay: 13,
      currentTimeBranch: "si"
    }
  },
  {
    birth: {
      name: "dynamic-sample-not-started",
      gender: "female",
      calendar: "solar",
      year: 1995,
      month: 2,
      day: 4,
      hour: 23
    },
    dynamicInput: {
      currentAge: 1,
      currentYear: 2026,
      currentLunarMonth: 12,
      currentLunarDay: 30,
      currentTimeBranch: "zi"
    }
  }
]

function fail(message) {
  console.error(`Ziwei dynamic chart check failed: ${message}`)
  process.exit(1)
}

samples.forEach((sample) => {
  const chart = buildFullZiweiChart(sample.birth)
  const next = buildFullZiweiDynamicChart({
    chart,
    input: sample.dynamicInput
  })
  const legacy = buildZiweiDynamicChart({
    pattern: buildLegacyBirthPattern(sample.birth),
    gender: sample.birth.gender,
    ...sample.dynamicInput
  })

  if (!legacy.ok) {
    fail(`${sample.birth.name}: legacy dynamic chart failed: ${legacy.message}`)
  }

  const nextFlowPalaces = Object.fromEntries(
    next.flows.map((flow) => [flow.type, flow.palace])
  )
  const legacyFlowPalaces = Object.fromEntries(
    ["natal", "daYun", "liuNian", "liuYue", "liuRi", "liuShi"].map((type) => {
      return [type, legacy.data[type].palace]
    })
  )

  if (JSON.stringify(nextFlowPalaces) !== JSON.stringify(legacyFlowPalaces)) {
    fail(
      `${sample.birth.name}: flow palace mismatch ${JSON.stringify({
        nextFlowPalaces,
        legacyFlowPalaces
      })}`
    )
  }

  const comparableDebug = {
    direction: legacy.data.debug.direction,
    startAge: legacy.data.debug.startAge,
    currentAge: legacy.data.debug.currentAge,
    isDaYunStarted: legacy.data.debug.isDaYunStarted
  }

  if (JSON.stringify(next.debug) !== JSON.stringify(comparableDebug)) {
    fail(
      `${sample.birth.name}: debug mismatch ${JSON.stringify({
        next: next.debug,
        legacy: comparableDebug
      })}`
    )
  }
})

console.log("Ziwei dynamic chart check passed.")
