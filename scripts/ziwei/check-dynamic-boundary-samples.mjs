import { readdirSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import ts from "typescript"

const require = createRequire(import.meta.url)
const root = process.cwd()

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
} = require(path.join(root, "src/ai/destiny-core/ziwei-core/public-api"))
const {
  getLiuRiStem,
  getLiuShiStem,
  getLiuYueStem
} = require(path.join(
  root,
  "src/ai/destiny-core/ziwei-core/dynamic-chart/dynamic-flow-stems.ts"
))
const {
  findSolarByBaziLunarDate,
  getBaziLunarInfoBySolar
} = require(path.join(
  root,
  "src/ai/destiny-core/bazi-core/bazi-runtime/bazi-lunar-date-utils.ts"
))

const sampleDir = path.join(root, "data", "ziwei", "golden-samples")
const requiredSampleIds = [
  "1990-male-solar",
  "1991-male-yin-year-backward",
  "1990-female-yang-year-backward",
  "1991-female-yin-year-forward",
  "1995-female-not-started",
  "1988-male-hai-hour-boundary",
  "1988-male-zi-hour-boundary"
]

function fail(message) {
  console.error(`[check-dynamic-boundary-samples] ${message}`)
  process.exit(1)
}

function readSamples() {
  return readdirSync(sampleDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      return JSON.parse(readFileSync(path.join(sampleDir, file), "utf8"))
    })
}

function buildSampleDynamic(sample) {
  const chart = buildFullZiweiChart(sample.birthInput)
  const dynamicChart = buildFullZiweiDynamicChart({
    chart,
    input: sample.dynamicInput
  })

  return { chart, dynamicChart }
}

function flowPalaces(dynamicChart) {
  return Object.fromEntries(
    dynamicChart.flows.map((flow) => [flow.type, flow.palace])
  )
}

const samples = readSamples()
const samplesById = Object.fromEntries(
  samples.map((sample) => [sample.sampleId, sample])
)
const missingSampleIds = requiredSampleIds.filter((sampleId) => {
  return !samplesById[sampleId]
})

if (missingSampleIds.length > 0) {
  fail(`missing required sample ids: ${missingSampleIds.join(", ")}`)
}

for (const sample of samples) {
  const { dynamicChart } = buildSampleDynamic(sample)
  assertJsonEqual(
    sample.sampleId,
    "dynamicDebug",
    dynamicChart.debug,
    sample.expected.dynamicDebug
  )
  assertJsonEqual(
    sample.sampleId,
    "dynamicFlowPalaces",
    flowPalaces(dynamicChart),
    sample.expected.dynamicFlowPalaces
  )
}

assertHourBoundarySamples()
assertFlowTimeDoesNotCrossDayByItself()
assertLeapMonthBoundary()

console.log(
  `[check-dynamic-boundary-samples] ok (${samples.length} golden sample(s))`
)

function assertHourBoundarySamples() {
  const hai = samplesById["1988-male-hai-hour-boundary"]
  const zi = samplesById["1988-male-zi-hour-boundary"]
  const haiResult = buildSampleDynamic(hai)
  const ziResult = buildSampleDynamic(zi)

  assertEqual(
    "1988 hour boundary",
    "hai life palace",
    haiResult.chart.summary.lifePalace,
    "shen"
  )
  assertEqual(
    "1988 hour boundary",
    "zi life palace",
    ziResult.chart.summary.lifePalace,
    "wei"
  )
  assertEqual(
    "1988 hour boundary",
    "hai dou jun",
    haiResult.dynamicChart.debug.douJunPalace,
    "zi"
  )
  assertEqual(
    "1988 hour boundary",
    "zi dou jun",
    ziResult.dynamicChart.debug.douJunPalace,
    "chou"
  )
}

function assertFlowTimeDoesNotCrossDayByItself() {
  const chart = buildFullZiweiChart({
    name: "flow-time-boundary",
    gender: "male",
    calendar: "solar",
    year: 1990,
    month: 5,
    day: 17,
    hour: 9
  })
  const baseInput = {
    currentAge: 36,
    currentYear: 2026,
    currentLunarMonth: 7,
    currentLunarDay: 1
  }
  const hai = buildFullZiweiDynamicChart({
    chart,
    input: {
      ...baseInput,
      currentTimeBranch: "hai"
    }
  })
  const zi = buildFullZiweiDynamicChart({
    chart,
    input: {
      ...baseInput,
      currentTimeBranch: "zi"
    }
  })
  const haiPalaces = flowPalaces(hai)
  const ziPalaces = flowPalaces(zi)

  assertEqual(
    "flow time no cross day",
    "liu ri palace",
    ziPalaces.liuRi,
    haiPalaces.liuRi
  )
  assertEqual(
    "flow time no cross day",
    "zi hour starts from liu ri palace",
    ziPalaces.liuShi,
    ziPalaces.liuRi
  )

  const liuRiStem = getLiuRiStem(baseInput)
  assertEqual(
    "flow time no cross day",
    "zi hour stem",
    getLiuShiStem({
      ...baseInput,
      currentTimeBranch: "zi"
    }),
    getLiuShiStem({
      ...baseInput,
      currentTimeBranch: "zi",
      currentLunarDay: baseInput.currentLunarDay
    })
  )
  assertEqual(
    "flow time no cross day",
    "liu ri stem stable",
    getLiuRiStem(baseInput),
    liuRiStem
  )
}

function assertLeapMonthBoundary() {
  const regularSecondMonth = findSolarByBaziLunarDate({
    lunarYear: 2023,
    lunarMonth: 2,
    lunarDay: 1,
    includeLeapMonth: false
  })
  const leapSecondMonth = getBaziLunarInfoBySolar({
    year: 2023,
    month: 3,
    day: 22
  })

  if (!regularSecondMonth) {
    fail("2023 regular second lunar month not found")
  }

  assertJsonEqual(
    "leap month boundary",
    "regular lunar date",
    {
      solarYear: regularSecondMonth.solarYear,
      solarMonth: regularSecondMonth.solarMonth,
      solarDay: regularSecondMonth.solarDay,
      isLeapMonth: regularSecondMonth.lunar.isLeapMonth
    },
    {
      solarYear: 2023,
      solarMonth: 2,
      solarDay: 20,
      isLeapMonth: false
    }
  )
  assertJsonEqual(
    "leap month boundary",
    "known leap lunar date",
    {
      lunarYear: leapSecondMonth.lunarYear,
      lunarMonth: leapSecondMonth.lunarMonth,
      lunarDay: leapSecondMonth.lunarDay,
      isLeapMonth: leapSecondMonth.isLeapMonth
    },
    {
      lunarYear: 2023,
      lunarMonth: 2,
      lunarDay: 1,
      isLeapMonth: true
    }
  )
  assertEqual(
    "leap month boundary",
    "liu yue stem",
    getLiuYueStem({
      currentYear: 2023,
      currentLunarMonth: 2
    }),
    "yi"
  )
  assertEqual(
    "leap month boundary",
    "liu ri stem",
    getLiuRiStem({
      currentYear: 2023,
      currentLunarMonth: 2,
      currentLunarDay: 1
    }),
    "ji"
  )
  assertEqual(
    "leap month boundary",
    "liu shi stem",
    getLiuShiStem({
      currentYear: 2023,
      currentLunarMonth: 2,
      currentLunarDay: 1,
      currentTimeBranch: "zi"
    }),
    "jia"
  )
}

function assertEqual(sampleId, key, actual, expected) {
  if (actual !== expected) {
    fail(`${sampleId}: ${key} expected ${expected}, got ${actual}`)
  }
}

function assertJsonEqual(sampleId, key, actual, expected) {
  const actualJson = JSON.stringify(actual)
  const expectedJson = JSON.stringify(expected)

  if (actualJson !== expectedJson) {
    fail(`${sampleId}: ${key} expected ${expectedJson}, got ${actualJson}`)
  }
}
