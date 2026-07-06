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
      esModuleInterop: true
    }
  }).outputText

  module._compile(output, filename)
}

const {
  buildFullZiweiChart,
  buildFullZiweiDynamicChart,
  buildZiweiInterpretation
} = require("../../src/ai/destiny-core/ziwei-core/public-api/index.ts")

function fail(message) {
  console.error(`[check-current-evidence-chain] ${message}`)
  process.exit(1)
}

const chart = buildFullZiweiChart({
  calendarType: "solar",
  year: 1990,
  month: 5,
  day: 17,
  hour: 9,
  gender: "male",
  timezone: "Asia/Shanghai"
})
const dynamicChart = buildFullZiweiDynamicChart({
  chart,
  input: {
    currentAge: 36,
    currentYear: 2026,
    currentLunarMonth: 5,
    currentLunarDay: 13,
    currentTimeBranch: "si"
  }
})
const interpretation = buildZiweiInterpretation({ chart, dynamicChart })
const chains = interpretation.detailedAnalysis.currentEvidenceChains

if (chains.length < 60) {
  fail(`expected at least 60 evidence chains, got ${chains.length}`)
}

assertKind(chains, "natal-palace")
assertKind(chains, "star")
assertKind(chains, "same-palace-combination")
assertKind(chains, "palace-relation")
assertKind(chains, "dynamic-flow")
assertKind(chains, "pattern-boundary")

if (interpretation.detailedAnalysis.evidenceSummaryLines.length < 4) {
  fail("expected evidence summary lines")
}

if (interpretation.detailedAnalysis.debug.evidenceChainCount !== chains.length) {
  fail("debug evidenceChainCount mismatch")
}

for (const chain of chains) {
  assertString(chain.chainId, chain.title, "title", 4)
  assertString(chain.chainId, chain.summary, "summary", 12)
  assertList(chain.chainId, chain.dictionaryRefs, "dictionaryRefs", 1)
  assertList(chain.chainId, chain.evidenceLines, "evidenceLines", 3)
  assertList(chain.chainId, chain.interpretationBoundary, "interpretationBoundary", 3)

  if (chain.kind !== "pattern-boundary" && chain.sourceRuleIds.length === 0) {
    fail(`${chain.chainId}: missing sourceRuleIds`)
  }
}

const dynamicChains = chains.filter((chain) => chain.flowType !== "natal")

if (dynamicChains.length < 5) {
  fail("expected dynamic flow evidence chains")
}

if (!chains.some((chain) => {
  return chain.interpretationBoundary.some((line) => line.includes("不显示未命中格局"))
})) {
  fail("missing unhit pattern display boundary")
}

console.log("[check-current-evidence-chain] ok")

function assertKind(chains, kind) {
  if (!chains.some((chain) => chain.kind === kind)) {
    fail(`missing evidence kind: ${kind}`)
  }
}

function assertString(id, value, field, minLength) {
  if (typeof value !== "string" || value.length < minLength) {
    fail(`${id}: ${field} is too short`)
  }
}

function assertList(id, value, field, minLength) {
  if (!Array.isArray(value) || value.length < minLength) {
    fail(`${id}: ${field} needs at least ${minLength} item(s)`)
  }
}
