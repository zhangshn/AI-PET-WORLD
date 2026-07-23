import fs from "node:fs"
import path from "node:path"

const cwd = process.cwd()
const learningRoot = path.resolve(".runtime/ai-painter/auto-visual-judge-learning")
const latestLearningPath = path.join(learningRoot, "latest.json")

export function refreshGameMapAutoVisualJudgeLearning(options = {}) {
  const timestamp = new Date().toISOString()
  const runId = `auto-visual-judge-learning-${timestamp.replace(/[:.]/g, "-")}`
  const evidence = collectEvidence()
  const learnedFailurePatterns = buildLearnedFailurePatterns(evidence)
  const currentDecision = buildCurrentDecision(evidence, learnedFailurePatterns)
  const runRoot = path.join(learningRoot, "history", runId)
  const historyPath = path.join(runRoot, "auto-visual-judge-learning.json")

  const learningRecord = {
    schemaVersion: "game-map-auto-visual-judge-learning-v1",
    createdAt: timestamp,
    runId,
    createdByProgram: true,
    manualEdited: false,
    codexGenerated: false,
    trigger: options.trigger ?? "manual_refresh",
    triggerEventId: options.triggerEventId ?? null,
    learningMode: "evidence_driven_program_learning",
    learningModeZh: "证据驱动程序学习",
    meaning:
      "The program learns reusable judgment memory from persisted complete-map machine reviews, material reports, FormalVisualJudge reports, owner reviews, and review-gap diagnostics. This is programmatic evidence learning, not a chat explanation.",
    meaningZh:
      "程序从已落盘的完整地图机器审核、材料报告、FormalVisualJudge、人工审核和漏判诊断中学习可复用判断记忆。这是程序证据学习，不是聊天解释。",
    evidenceSummary: {
      ledgerEventCount: evidence.ledgerEvents.length,
      completeMapMachineReviewCount: evidence.completeMapMachineReviews.length,
      materialQualityReportCount: evidence.materialReports.length,
      formalVisualJudgeReportCount: evidence.formalReports.length,
      ownerReviewCount: evidence.ownerReviews.length,
      reviewDiagnosisCount: evidence.reviewDiagnostics.length,
    },
    currentDecision,
    learnedFailurePatterns,
    nextAutonomousJudgeInputs: buildNextAutonomousJudgeInputs(learnedFailurePatterns),
    evidenceRecords: {
      latestMaterialQualityReportPath: evidence.materialReports[0]?.path ?? null,
      latestCompleteMapMachineReviewPath: evidence.completeMapMachineReviews[0]?.path ?? null,
      latestFormalVisualJudgePath: evidence.formalReports[0]?.path ?? null,
      latestOwnerReviewPath: evidence.ownerReviews[0]?.path ?? null,
      latestReviewDiagnosisPath: evidence.reviewDiagnostics[0]?.path ?? null,
    },
    historyPath,
  }

  writeJson(historyPath, learningRecord)
  writeJson(latestLearningPath, learningRecord)
  return learningRecord
}

export { latestLearningPath }

function collectEvidence() {
  return {
    ledgerEvents: readLedgerEvents().slice(-200),
    completeMapMachineReviews: collectJsonEvidence(
      [
        ".runtime/ai-painter/complete-world-visual-machine-reviews",
        ".runtime/ai-painter/ai-assisted-conditional-inference-validation",
        "data/world-samples/original-image-library/natural-home-v1",
      ],
      "machine-review.json",
      80,
    ),
    materialReports: collectJsonEvidence(
      [
        ".runtime/game-map-material-slot-inference-runs",
        ".runtime/ai-painter/training-run-archive",
      ],
      "material-quality-report.json",
      80,
    ),
    formalReports: collectJsonEvidence(
      [".runtime/game-map-runtime-compositor"],
      (fileName) => fileName.endsWith("-formal-visual-judge.json") || fileName === "formal-visual-judge.json",
      40,
    ),
    ownerReviews: collectJsonEvidence(
      [
        ".runtime/game-map-owner-reviews",
        ".runtime/ai-painter/auto-visual-judge-learning/original-image-owner-failures",
      ],
      (fileName) => fileName === "owner-review.json" || fileName === "failure-record.json",
      80,
    ),
    reviewDiagnostics: collectJsonEvidence([".runtime/game-map-review-diagnostics"], "review-diagnosis.json", 40),
  }
}

function readLedgerEvents() {
  const ledgerPath = path.resolve(".runtime/ai-painter/training-process-ledger/events.jsonl")
  if (!fs.existsSync(ledgerPath)) return []
  const raw = fs.readFileSync(ledgerPath, "utf8").trim()
  if (!raw) return []
  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => safeJsonParse(line))
    .filter(Boolean)
}

function collectJsonEvidence(roots, matcher, limit) {
  const files = []
  for (const root of roots) {
    const resolvedRoot = path.resolve(root)
    if (!fs.existsSync(resolvedRoot)) continue
    collectFiles(resolvedRoot, matcher, files)
  }
  return files
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, limit)
    .map((file) => ({
      path: projectRelative(file.path),
      updatedAt: new Date(file.mtimeMs).toISOString(),
      data: readJsonOrNull(file.path),
    }))
    .filter((entry) => entry.data)
}

function collectFiles(root, matcher, files) {
  const stack = [root]
  while (stack.length > 0) {
    const current = stack.pop()
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(fullPath)
        continue
      }
      const matched =
        typeof matcher === "function" ? matcher(entry.name, fullPath) : entry.name === matcher
      if (entry.isFile() && matched) {
        files.push({ path: fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs })
      }
    }
  }
}

function buildLearnedFailurePatterns(evidence) {
  const patternMap = new Map()

  for (const review of evidence.completeMapMachineReviews) {
    for (const issue of review.data?.issues ?? []) {
      if (!issue?.code) continue
      addPattern(patternMap, issue.code, {
        sourceKind: "complete_map_machine_review",
        sourceKindZh: "完整地图机器审核",
        occurrenceCount: 1,
        evidencePath: review.path,
        targetArea: issue.affectedRegion ?? inferTargetArea(issue.code),
        blocksWorld: true,
        message: issue.messageZh ?? issue.message ?? null,
      })
    }
  }

  for (const report of evidence.materialReports) {
    const issueCounts = report.data?.summary?.issueCounts ?? {}
    for (const [code, count] of Object.entries(issueCounts)) {
      addPattern(patternMap, code, {
        sourceKind: "material_quality_report",
        sourceKindZh: "材料质量报告",
        occurrenceCount: Number(count) || 1,
        evidencePath: report.path,
        targetArea: inferTargetArea(code),
        blocksWorld: true,
      })
    }
    for (const slot of report.data?.slots ?? []) {
      if (slot?.passed !== false) continue
      for (const issue of slot.issues ?? []) {
        const code = typeof issue === "string" ? issue : issue?.code
        if (!code) continue
        addPattern(patternMap, code, {
          sourceKind: "material_failed_slot",
          sourceKindZh: "材料槽失败样本",
          occurrenceCount: 1,
          evidencePath: report.path,
          targetArea: inferTargetArea(`${slot.unitKind ?? ""}_${code}`),
          blocksWorld: true,
        })
      }
    }
  }

  for (const report of evidence.formalReports) {
    for (const issue of report.data?.issues ?? []) {
      if (!issue?.code) continue
      addPattern(patternMap, issue.code, {
        sourceKind: "formal_visual_judge",
        sourceKindZh: "正式画面机器评审",
        occurrenceCount: 1,
        evidencePath: report.path,
        targetArea: inferTargetArea(issue.code),
        blocksWorld: true,
        message: issue.message ?? null,
      })
    }
  }

  for (const diagnosis of evidence.reviewDiagnostics) {
    for (const rootCause of diagnosis.data?.rootCauses ?? []) {
      if (!rootCause?.code) continue
      addPattern(patternMap, rootCause.code, {
        sourceKind: "review_gap_diagnosis",
        sourceKindZh: "机器判断漏判诊断",
        occurrenceCount: 1,
        evidencePath: diagnosis.path,
        targetArea: inferTargetArea(rootCause.code),
        blocksWorld: true,
        message: rootCause.detailZh ?? rootCause.detail ?? null,
        requiresJudgeUpgrade: true,
      })
    }
    for (const fix of diagnosis.data?.requiredFixesZh ?? []) {
      addPattern(patternMap, normalizePatternCode(fix), {
        sourceKind: "required_fix",
        sourceKindZh: "必需修复项",
        occurrenceCount: 1,
        evidencePath: diagnosis.path,
        targetArea: inferTargetArea(fix),
        blocksWorld: true,
        message: fix,
        requiresJudgeUpgrade: true,
      })
    }
  }

  for (const review of evidence.ownerReviews) {
    for (const code of review.data?.reasonCodes ?? []) {
      addPattern(patternMap, code, {
        sourceKind: "owner_review",
        sourceKindZh: "项目所有者人工审核",
        occurrenceCount: 1,
        evidencePath: review.path,
        targetArea: inferTargetArea(code),
        blocksWorld: true,
        requiresJudgeUpgrade: true,
      })
    }
  }

  return Array.from(patternMap.values()).sort((a, b) => b.occurrenceCount - a.occurrenceCount)
}

function addPattern(patternMap, rawCode, sample) {
  const code = normalizePatternCode(rawCode)
  if (!code) return
  const existing =
    patternMap.get(code) ??
    {
      code,
      targetArea: sample.targetArea,
      occurrenceCount: 0,
      sourceKinds: [],
      sourceKindsZh: [],
      evidencePaths: [],
      blocksWorld: false,
      requiresJudgeUpgrade: false,
      messages: [],
      learnedDecision: "block_until_repaired",
      learnedDecisionZh: "自动阻断，直到修复并重新通过质量闸门",
    }
  existing.occurrenceCount += sample.occurrenceCount
  addUnique(existing.sourceKinds, sample.sourceKind)
  addUnique(existing.sourceKindsZh, sample.sourceKindZh)
  addUnique(existing.evidencePaths, sample.evidencePath)
  if (sample.message) addUnique(existing.messages, sample.message)
  existing.blocksWorld = existing.blocksWorld || sample.blocksWorld === true
  existing.requiresJudgeUpgrade = existing.requiresJudgeUpgrade || sample.requiresJudgeUpgrade === true
  patternMap.set(code, existing)
}

function buildCurrentDecision(evidence, learnedFailurePatterns) {
  const latestMaterial = evidence.materialReports[0]?.data
  const latestFormal = evidence.formalReports[0]?.data
  const latestOwner = evidence.ownerReviews[0]?.data
  const latestCompleteMapReview = evidence.completeMapMachineReviews[0]?.data
  const ownerRejected = latestOwner?.ownerDecision === "rejected" || latestOwner?.status === "failed"
  const blockers = []

  if (latestMaterial && latestMaterial.passed !== true) {
    blockers.push("material_quality_failed")
  }
  if (latestCompleteMapReview && latestCompleteMapReview.passed !== true) {
    blockers.push("complete_map_machine_review_failed")
  }
  if (latestFormal && (latestFormal.passed !== true || latestFormal.canEnterWorld === false)) {
    blockers.push("formal_visual_judge_failed")
  }
  if (ownerRejected) {
    blockers.push("owner_review_rejected")
  }
  for (const pattern of learnedFailurePatterns.slice(0, 8)) {
    if (pattern.blocksWorld) blockers.push(pattern.code)
  }

  const blocked = blockers.length > 0
  return {
    status: blocked ? "blocked" : "candidate_machine_clear",
    statusZh: blocked ? "自动判断阻断" : "机器候选暂未发现阻断",
    canEnterWorld: false,
    canEnterWorldZh:
      "不能直接作为玩家可见最终地图；只有完整 RuntimeFrame 通过全部机器闸门并获得项目所有者人工终审通过后才允许。",
    blockerCodes: Array.from(new Set(blockers)),
    confidence: blocked ? "high" : "low_until_owner_review",
    confidenceZh: blocked ? "高：存在明确失败证据" : "低：仍需人工终审和更多证据",
  }
}

function buildNextAutonomousJudgeInputs(patterns) {
  const currentCompleteMapPatterns = patterns.filter((pattern) =>
    pattern.sourceKinds.includes("complete_map_machine_review"),
  )
  const supportingHistoricalPatterns = patterns.filter((pattern) =>
    !pattern.sourceKinds.includes("complete_map_machine_review"),
  )
  return [...currentCompleteMapPatterns, ...supportingHistoricalPatterns]
    .filter((pattern) => pattern.blocksWorld || pattern.requiresJudgeUpgrade)
    .slice(0, 12)
    .map((pattern) => ({
      code: pattern.code,
      targetArea: pattern.targetArea,
      occurrenceCount: pattern.occurrenceCount,
      action: pattern.requiresJudgeUpgrade ? "upgrade_judge_gate" : "keep_blocking_rule",
      actionZh: pattern.requiresJudgeUpgrade ? "升级自动评审闸门" : "保留自动阻断规则",
      evidencePaths: pattern.evidencePaths.slice(0, 5),
    }))
}

function inferTargetArea(value) {
  const text = String(value).toLowerCase()
  if (text.includes("grass") || text.includes("草")) return "grass"
  if (text.includes("path") || text.includes("road") || text.includes("路")) return "road"
  if (text.includes("water") || text.includes("水")) return "water"
  if (text.includes("shore")) return "shoreline"
  if (text.includes("tree") || text.includes("树")) return "tree"
  if (text.includes("rock") || text.includes("石")) return "rock"
  if (text.includes("gray") || text.includes("灰")) return "terrain_artifact"
  return "whole_frame"
}

function normalizePatternCode(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120)
}

function addUnique(list, value) {
  if (value && !list.includes(value)) list.push(value)
}

function readJsonOrNull(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"))
  } catch {
    return null
  }
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function projectRelative(filePath) {
  const relative = path.relative(cwd, filePath)
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative)
    ? relative.replace(/\\/g, "/")
    : filePath
}
