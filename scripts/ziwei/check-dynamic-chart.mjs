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
    },
    expectedDirection: "forward",
    expectedXiaoXian: {
      direction: "forward",
      startPalace: "chen",
      palace: "mao"
    },
    expectedDouJunPalace: "shen",
    expectedLiuNianFlowingStars: {
      lucun: "si",
      qingyang: "wu",
      tuoluo: "chen",
      tianma: "shen",
      tiankui: "hai",
      tianyue: "you"
    },
    expectedFlowStems: {
      liuNian: { stem: "bing", stemSource: "currentYearStem" },
      liuYue: { stem: "jia", stemSource: "currentMonthStem" },
      liuRi: { stem: "ren", stemSource: "currentDayStem" },
      liuShi: { stem: "yi", stemSource: "currentTimeStem" }
    },
    expectedLiuYueFlowingStars: {
      lucun: "yin",
      qingyang: "mao",
      tuoluo: "chou",
      tianma: "yin",
      tiankui: "chou",
      tianyue: "wei"
    },
    expectedLiuRiFlowingStars: {
      lucun: "hai",
      qingyang: "zi",
      tuoluo: "xu",
      tianma: "yin",
      tiankui: "mao",
      tianyue: "si"
    },
    expectedLiuShiFlowingStars: {
      lucun: "mao",
      qingyang: "chen",
      tuoluo: "yin",
      tianma: "hai",
      tiankui: "zi",
      tianyue: "shen"
    },
    expectedAnnualCycleStarCounts: {
      natal: 0,
      daYun: 0,
      liuNian: 36,
      liuYue: 0,
      liuRi: 0,
      liuShi: 0
    },
    expectedLiuNianAnnualCycleStarts: {
      boshi: "si",
      suijian: "wu",
      jiangxing: "wu"
    }
  },
  {
    birth: {
      name: "dynamic-sample-yin-male-backward",
      gender: "male",
      calendar: "solar",
      year: 1991,
      month: 5,
      day: 17,
      hour: 9
    },
    dynamicInput: {
      currentAge: 36,
      currentYear: 2027,
      currentLunarMonth: 5,
      currentLunarDay: 13,
      currentTimeBranch: "si"
    },
    expectedDirection: "backward",
    expectedXiaoXian: {
      direction: "forward",
      startPalace: "chou",
      palace: "zi"
    },
    expectedDouJunPalace: "you"
  },
  {
    birth: {
      name: "dynamic-sample-yang-female-backward",
      gender: "female",
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
    },
    expectedDirection: "backward",
    expectedXiaoXian: {
      direction: "backward",
      startPalace: "chen",
      palace: "si"
    },
    expectedDouJunPalace: "shen"
  },
  {
    birth: {
      name: "dynamic-sample-yin-female-forward",
      gender: "female",
      calendar: "solar",
      year: 1991,
      month: 5,
      day: 17,
      hour: 9
    },
    dynamicInput: {
      currentAge: 36,
      currentYear: 2027,
      currentLunarMonth: 5,
      currentLunarDay: 13,
      currentTimeBranch: "si"
    },
    expectedDirection: "forward",
    expectedXiaoXian: {
      direction: "backward",
      startPalace: "chou",
      palace: "yin"
    },
    expectedDouJunPalace: "you"
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
    },
    expectedDirection: "forward",
    expectedXiaoXian: {
      direction: "backward",
      startPalace: "chou",
      palace: "chou"
    },
    expectedDouJunPalace: "wu"
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
    isDaYunStarted: legacy.data.debug.isDaYunStarted,
    xiaoXianDirection: legacy.data.debug.xiaoXianDirection,
    xiaoXianStartPalace: legacy.data.debug.xiaoXianStartPalace,
    xiaoXianPalace: legacy.data.debug.xiaoXianPalace,
    douJunPalace: legacy.data.debug.douJunPalace
  }

  if (JSON.stringify(next.debug) !== JSON.stringify(comparableDebug)) {
    fail(
      `${sample.birth.name}: debug mismatch ${JSON.stringify({
        next: next.debug,
        legacy: comparableDebug
      })}`
    )
  }

  if (next.debug.direction !== sample.expectedDirection) {
    fail(
      `${sample.birth.name}: direction mismatch ${JSON.stringify({
        actual: next.debug.direction,
        expected: sample.expectedDirection
      })}`
    )
  }

  const actualXiaoXian = {
    direction: next.debug.xiaoXianDirection,
    startPalace: next.debug.xiaoXianStartPalace,
    palace: next.debug.xiaoXianPalace
  }

  if (JSON.stringify(actualXiaoXian) !== JSON.stringify(sample.expectedXiaoXian)) {
    fail(
      `${sample.birth.name}: xiao xian mismatch ${JSON.stringify({
        actual: actualXiaoXian,
        expected: sample.expectedXiaoXian
      })}`
    )
  }

  if (next.debug.douJunPalace !== sample.expectedDouJunPalace) {
    fail(
      `${sample.birth.name}: dou jun mismatch ${JSON.stringify({
        actual: next.debug.douJunPalace,
        expected: sample.expectedDouJunPalace
      })}`
    )
  }

  next.flows.forEach((flow) => {
    const expectedCount = flow.type === "natal" ? 0 : 6

    if (flow.flowingStars.length !== expectedCount) {
      fail(
        `${sample.birth.name}: dynamic flowing star count mismatch ${JSON.stringify({
          flowType: flow.type,
          actual: flow.flowingStars.length,
          expected: expectedCount
        })}`
      )
    }
  })

  if (sample.expectedLiuNianFlowingStars) {
    const liuNianFlow = next.flows.find((flow) => flow.type === "liuNian")
    const actual = Object.fromEntries(
      liuNianFlow.flowingStars.map((star) => {
        return [star.starId.split(".").at(-1), star.branch]
      })
    )

    if (JSON.stringify(actual) !== JSON.stringify(sample.expectedLiuNianFlowingStars)) {
      fail(
        `${sample.birth.name}: liu nian flowing stars mismatch ${JSON.stringify({
          actual,
          expected: sample.expectedLiuNianFlowingStars
        })}`
      )
    }
  }

  if (sample.expectedFlowStems) {
    Object.entries(sample.expectedFlowStems).forEach(([flowType, expected]) => {
      const flow = next.flows.find((item) => item.type === flowType)
      const actual = {
        stem: flow.stem,
        stemSource: flow.stemSource
      }

      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        fail(
          `${sample.birth.name}: flow stem mismatch ${JSON.stringify({
            flowType,
            actual,
            expected
          })}`
        )
      }
    })
  }

  ;[
    ["liuYue", sample.expectedLiuYueFlowingStars],
    ["liuRi", sample.expectedLiuRiFlowingStars],
    ["liuShi", sample.expectedLiuShiFlowingStars]
  ].forEach(([flowType, expected]) => {
    if (!expected) {
      return
    }

    const flow = next.flows.find((item) => item.type === flowType)
    const actual = Object.fromEntries(
      flow.flowingStars.map((star) => {
        return [star.starId.split(".").at(-1), star.branch]
      })
    )

    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      fail(
        `${sample.birth.name}: ${flowType} flowing stars mismatch ${JSON.stringify({
          actual,
          expected
        })}`
      )
    }
  })

  if (sample.expectedAnnualCycleStarCounts) {
    next.flows.forEach((flow) => {
      const expected = sample.expectedAnnualCycleStarCounts[flow.type]

      if (flow.annualCycleStars.length !== expected) {
        fail(
          `${sample.birth.name}: annual cycle star count mismatch ${JSON.stringify({
            flowType: flow.type,
            actual: flow.annualCycleStars.length,
            expected
          })}`
        )
      }
    })
  }

  if (sample.expectedLiuNianAnnualCycleStarts) {
    const liuNianFlow = next.flows.find((flow) => flow.type === "liuNian")
    const actual = Object.fromEntries(
      Object.keys(sample.expectedLiuNianAnnualCycleStarts).map((starKey) => {
        const star = liuNianFlow.annualCycleStars.find((item) => {
          return item.starId.split(".").at(-1) === starKey
        })

        return [starKey, star?.branch]
      })
    )

    if (
      JSON.stringify(actual) !==
      JSON.stringify(sample.expectedLiuNianAnnualCycleStarts)
    ) {
      fail(
        `${sample.birth.name}: liu nian annual cycle starts mismatch ${JSON.stringify({
          actual,
          expected: sample.expectedLiuNianAnnualCycleStarts
        })}`
      )
    }
  }
})

console.log("Ziwei dynamic chart check passed.")
